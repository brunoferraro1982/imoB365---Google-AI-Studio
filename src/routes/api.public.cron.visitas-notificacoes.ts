import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Roda a cada 30 min via pg_cron.
// 1) Lembrete por e-mail 24h antes da visita (uma vez por visita).
// 2) Pedido de NPS após visita realizada (uma vez por visita).

function escape(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function lembreteHtml(opts: { nome: string; titulo: string; data: string; endereco: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 12px">Olá, ${escape(opts.nome)}!</h2>
    <p style="color:#555">Lembrete: sua visita está agendada para <strong>${escape(opts.data)}</strong>.</p>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0">
      <p style="margin:0 0 6px"><strong>Imóvel:</strong> ${escape(opts.titulo)}</p>
      <p style="margin:0"><strong>Endereço:</strong> ${escape(opts.endereco)}</p>
    </div>
    <p style="font-size:12px;color:#888">Em caso de imprevisto, entre em contato com o corretor responsável.</p>
  </div>`;
}

function npsHtml(opts: { nome: string; titulo: string; link: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 12px">Como foi sua visita, ${escape(opts.nome)}?</h2>
    <p style="color:#555">Sua opinião sobre <strong>${escape(opts.titulo)}</strong> nos ajuda a melhorar.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escape(opts.link)}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Avaliar a visita</a>
    </p>
    <p style="font-size:12px;color:#888">Leva menos de 30 segundos.</p>
  </div>`;
}

export const Route = createFileRoute("/api/public/cron/visitas-notificacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.trim() === "" || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const baseUrl = process.env.SITE_URL || new URL(request.url).origin;
        let lembretes = 0;
        let nps = 0;

        // === Lembretes 24h antes ===
        const fim = new Date(Date.now() + 26 * 60 * 60 * 1000);
        const min = new Date(Date.now() + 22 * 60 * 60 * 1000);

        const { data: paraLembrar } = await supabaseAdmin
          .from("visitas")
          .select("id, data_hora, visitante_nome, visitante_email, observacoes, imovel_id, imoveis(titulo,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade)")
          .in("status", ["agendada", "confirmada"])
          .is("lembrete_enviado_at", null)
          .gte("data_hora", min.toISOString())
          .lte("data_hora", fim.toISOString())
          .not("visitante_email", "is", null)
          .limit(200);

        for (const v of paraLembrar ?? []) {
          const im: any = (v as any).imoveis;
          if (!im || !v.visitante_email) continue;
          const endereco = [im.endereco_logradouro, im.endereco_numero, im.endereco_bairro, im.endereco_cidade]
            .filter(Boolean).join(", ");
          const dataFmt = new Date(v.data_hora as string).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: v.visitante_email,
              subject: `Lembrete: visita em ${dataFmt}`,
              html: lembreteHtml({ nome: v.visitante_nome ?? "visitante", titulo: im.titulo ?? "imóvel", data: dataFmt, endereco }),
              label: "lembrete_visita",
              sender_domain: "notify.imob365.com.br",
              from: "imob365 <no-reply@notify.imob365.com.br>",
              purpose: "transactional",
              message_id: crypto.randomUUID(),
            },
          } as any);

          await supabaseAdmin.from("visitas").update({ lembrete_enviado_at: new Date().toISOString() }).eq("id", v.id);
          lembretes++;
        }

        // === NPS pós-visita ===
        const limiteNps = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h após
        const limiteMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // até 7 dias atrás

        const { data: paraNps } = await supabaseAdmin
          .from("visitas")
          .select("id, checkin_token, visitante_nome, visitante_email, imoveis(titulo)")
          .eq("status", "realizada")
          .is("nps_enviado_at", null)
          .is("nps_respondido_at", null)
          .lte("data_hora", limiteNps.toISOString())
          .gte("data_hora", limiteMin.toISOString())
          .not("visitante_email", "is", null)
          .not("checkin_token", "is", null)
          .limit(200);

        for (const v of paraNps ?? []) {
          const im: any = (v as any).imoveis;
          if (!v.visitante_email || !v.checkin_token) continue;
          const link = `${baseUrl}/visita-checkin/${v.checkin_token}`;

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: v.visitante_email,
              subject: "Como foi sua visita?",
              html: npsHtml({ nome: v.visitante_nome ?? "visitante", titulo: im?.titulo ?? "imóvel", link }),
              label: "nps_visita",
              sender_domain: "notify.imob365.com.br",
              from: "imob365 <no-reply@notify.imob365.com.br>",
              purpose: "transactional",
              message_id: crypto.randomUUID(),
            },
          } as any);

          await supabaseAdmin.from("visitas").update({ nps_enviado_at: new Date().toISOString() }).eq("id", v.id);
          nps++;
        }

        return Response.json({ ok: true, lembretes, nps });
      },
    },
  },
});