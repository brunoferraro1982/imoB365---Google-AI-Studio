import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSlaCheck, type EnviarEmailAlerta } from "@/lib/slaAlertas";

// Roda periodicamente via pg_cron (uma vez agendado — ver comentário em
// supabase/migrations para instruções). Varre todos os tenants: cartórios
// parados, contratos ativos a vencer, garantia/reajuste/vistoria/ordem de
// serviço/documento pendente e renovação automática se aproximando (CLM
// Sprint 11) — cria tarefas em lead_tarefas direcionadas ao corretor
// responsável (via contratos.corretor_id -> corretores.user_id).

const enviarEmailAlerta: EnviarEmailAlerta = async ({ userId, subject, html }) => {
  if (!userId) return;
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const to = data?.user?.email;
  if (!to) return;
  await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to,
      subject,
      html,
      label: "clm_alerta",
      sender_domain: "notify.imob365.com.br",
      from: "imob365 <no-reply@notify.imob365.com.br>",
      purpose: "transactional",
      message_id: crypto.randomUUID(),
    },
  } as any);
};

export const Route = createFileRoute("/api/public/cron/contratos-sla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await runSlaCheck(supabaseAdmin, { enviarEmail: enviarEmailAlerta });
        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
