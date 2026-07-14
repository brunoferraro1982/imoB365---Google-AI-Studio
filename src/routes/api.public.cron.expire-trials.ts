import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Roda 1x/dia via pg_cron (ver migration 20260714180000_mercadopago_subscriptions.sql).
// cron_expire_trials() no banco devolve, por tenant afetado, a ação tomada:
// - "notify": trial acabou agora, entra em período de graça de 3 dias — avisamos
//   por e-mail para assinar (link genérico para /app/contratacao, onde a pessoa
//   escolhe o plano e é redirecionada ao Mercado Pago).
// - "downgraded": período de graça esgotado sem assinatura confirmada — já foi
//   rebaixado para Free no próprio banco, só registramos aqui.

function emailHtml(opts: { nome: string; link: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 12px">Seu período de teste terminou</h2>
    <p style="color:#555">Olá, ${opts.nome}! Os 30 dias de teste do plano Business acabaram. Você
    tem mais 3 dias para escolher um plano e continuar usando todos os recursos sem interrupção.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${opts.link}" style="display:inline-block;background:#f2622c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Escolher meu plano</a>
    </p>
    <p style="font-size:12px;color:#888">Depois de 3 dias sem assinatura, sua conta passa
    automaticamente para o plano Free.</p>
  </div>`;
}

export const Route = createFileRoute("/api/public/cron/expire-trials")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const baseUrl = process.env.APP_URL || process.env.SITE_URL || new URL(request.url).origin;

        const { data: results, error } = await supabaseAdmin.rpc("cron_expire_trials");
        if (error) {
          console.error("Erro ao rodar cron_expire_trials", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        let notified = 0;
        let downgraded = 0;

        for (const r of results ?? []) {
          if (r.action === "downgraded") {
            downgraded++;
            continue;
          }
          if (r.action !== "notify") continue;

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, nome")
            .eq("tenant_id", r.tenant_id)
            .limit(1)
            .maybeSingle();
          if (!profile) continue;

          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          const email = authUser?.user?.email;
          if (!email) continue;

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: email,
              subject: "Seu período de teste terminou — escolha um plano",
              html: emailHtml({ nome: profile.nome ?? "", link: `${baseUrl}/app/contratacao` }),
              label: "trial_expirado",
              sender_domain: "notify.imob365.com.br",
              from: "imob365 <no-reply@notify.imob365.com.br>",
              purpose: "transactional",
              message_id: crypto.randomUUID(),
            },
          } as any);
          notified++;
        }

        return Response.json({ ok: true, notified, downgraded });
      },
    },
  },
});
