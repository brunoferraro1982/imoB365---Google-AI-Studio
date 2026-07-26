import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { marcarAtrasados } from "@/lib/inadimplencia";
import { formatBRL } from "@/lib/format";

// Roda uma vez por dia via pg_cron (ver
// supabase/migrations/20260726180000_inadimplencia_automatica.sql).
// 1) Marca lancamentos_financeiros vencidos (pendente + data_vencimento no
//    passado) como 'atrasado'.
// 2) Lembrete por e-mail ao time financeiro/admin do tenant: D-1 antes do
//    vencimento, D+1 e D+5 depois de atrasado — cada um enviado uma única
//    vez, controlado por lembrete_vencimento_enviado_at/
//    lembretes_atraso_enviados (mesmo padrão de marcador usado em
//    visitas.lembrete_enviado_at).

function escape(s: string | null | undefined) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function lembreteHtml(opts: {
  titulo: string;
  descricao: string;
  valor: string;
  vencimento: string;
}) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 12px">${escape(opts.titulo)}</h2>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0">
      <p style="margin:0 0 6px"><strong>Descrição:</strong> ${escape(opts.descricao)}</p>
      <p style="margin:0 0 6px"><strong>Valor:</strong> ${escape(opts.valor)}</p>
      <p style="margin:0"><strong>Vencimento:</strong> ${escape(opts.vencimento)}</p>
    </div>
    <p style="font-size:12px;color:#888">Acesse /app/financeiro pra ver o lançamento completo.</p>
  </div>`;
}

function addDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fmtDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Cache em memória só da execução atual do cron — evita repetir a mesma
// consulta de e-mails pro mesmo tenant quando há vários lançamentos dele
// no mesmo lote (D-1/D+1/D+5 podem repetir tenant_id).
const emailCacheByTenant = new Map<string, string[]>();

async function emailsFinanceiroDoTenant(tenantId: string): Promise<string[]> {
  if (emailCacheByTenant.has(tenantId)) return emailCacheByTenant.get(tenantId)!;
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "financeiro"]);
  const userIds = Array.from(new Set((roles ?? []).map((r: { user_id: string }) => r.user_id)));
  const emails = (await Promise.all(userIds.map((id) => supabaseAdmin.auth.admin.getUserById(id))))
    .map((r) => r.data?.user?.email)
    .filter((e): e is string => !!e);
  emailCacheByTenant.set(tenantId, emails);
  return emails;
}

async function enviarLembrete(tenantId: string, subject: string, html: string, label: string) {
  const emails = await emailsFinanceiroDoTenant(tenantId);
  for (const to of emails) {
    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        subject,
        html,
        label,
        sender_domain: "notify.imob365.com.br",
        from: "imob365 <no-reply@notify.imob365.com.br>",
        purpose: "transactional",
        message_id: crypto.randomUUID(),
      },
    } as any);
  }
}

type LancamentoLembrete = {
  id: string;
  tenant_id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
};

export const Route = createFileRoute("/api/public/cron/inadimplencia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { marcados } = await marcarAtrasados(supabaseAdmin);

        let avisosVencimento = 0;
        let avisosAtrasoD1 = 0;
        let avisosAtrasoD5 = 0;
        const erros: string[] = [];

        // D-1: vence amanhã, ainda pendente, nunca avisado.
        const { data: aVencer, error: erroVencer } = await supabaseAdmin
          .from("lancamentos_financeiros")
          .select("id,tenant_id,descricao,valor,data_vencimento")
          .eq("status", "pendente")
          .eq("data_vencimento", addDiasISO(1))
          .is("lembrete_vencimento_enviado_at", null)
          .limit(500);
        if (erroVencer) {
          console.error("[cron/inadimplencia] falha ao buscar avisos de vencimento", erroVencer);
          erros.push(`vencimento: ${erroVencer.message}`);
        }
        for (const l of (aVencer ?? []) as LancamentoLembrete[]) {
          await enviarLembrete(
            l.tenant_id,
            `Vence amanhã: ${l.descricao}`,
            lembreteHtml({
              titulo: "Lançamento vence amanhã",
              descricao: l.descricao,
              valor: formatBRL(Number(l.valor)),
              vencimento: fmtDataBR(l.data_vencimento),
            }),
            "inadimplencia_aviso_vencimento",
          );
          await (supabaseAdmin as any)
            .from("lancamentos_financeiros")
            .update({ lembrete_vencimento_enviado_at: new Date().toISOString() })
            .eq("id", l.id);
          avisosVencimento++;
        }

        // D+1 atrasado: 1 dia de atraso, primeiro lembrete de cobrança.
        const { data: atrasoD1, error: erroD1 } = await (supabaseAdmin as any)
          .from("lancamentos_financeiros")
          .select("id,tenant_id,descricao,valor,data_vencimento")
          .eq("status", "atrasado")
          .eq("data_vencimento", addDiasISO(-1))
          .eq("lembretes_atraso_enviados", 0)
          .limit(500);
        if (erroD1) {
          console.error("[cron/inadimplencia] falha ao buscar avisos de atraso D+1", erroD1);
          erros.push(`atraso_d1: ${erroD1.message}`);
        }
        for (const l of (atrasoD1 ?? []) as LancamentoLembrete[]) {
          await enviarLembrete(
            l.tenant_id,
            `Em atraso (1 dia): ${l.descricao}`,
            lembreteHtml({
              titulo: "Lançamento em atraso há 1 dia",
              descricao: l.descricao,
              valor: formatBRL(Number(l.valor)),
              vencimento: fmtDataBR(l.data_vencimento),
            }),
            "inadimplencia_atraso_d1",
          );
          await (supabaseAdmin as any)
            .from("lancamentos_financeiros")
            .update({ lembretes_atraso_enviados: 1 })
            .eq("id", l.id);
          avisosAtrasoD1++;
        }

        // D+5 atrasado: 5 dias de atraso, segundo (e último) lembrete de cobrança.
        const { data: atrasoD5, error: erroD5 } = await (supabaseAdmin as any)
          .from("lancamentos_financeiros")
          .select("id,tenant_id,descricao,valor,data_vencimento")
          .eq("status", "atrasado")
          .eq("data_vencimento", addDiasISO(-5))
          .eq("lembretes_atraso_enviados", 1)
          .limit(500);
        if (erroD5) {
          console.error("[cron/inadimplencia] falha ao buscar avisos de atraso D+5", erroD5);
          erros.push(`atraso_d5: ${erroD5.message}`);
        }
        for (const l of (atrasoD5 ?? []) as LancamentoLembrete[]) {
          await enviarLembrete(
            l.tenant_id,
            `Em atraso (5 dias): ${l.descricao}`,
            lembreteHtml({
              titulo: "Lançamento em atraso há 5 dias",
              descricao: l.descricao,
              valor: formatBRL(Number(l.valor)),
              vencimento: fmtDataBR(l.data_vencimento),
            }),
            "inadimplencia_atraso_d5",
          );
          await (supabaseAdmin as any)
            .from("lancamentos_financeiros")
            .update({ lembretes_atraso_enviados: 2 })
            .eq("id", l.id);
          avisosAtrasoD5++;
        }

        return Response.json({
          ok: erros.length === 0,
          marcados,
          avisosVencimento,
          avisosAtrasoD1,
          avisosAtrasoD5,
          ...(erros.length > 0 ? { erros } : {}),
        });
      },
    },
  },
});
