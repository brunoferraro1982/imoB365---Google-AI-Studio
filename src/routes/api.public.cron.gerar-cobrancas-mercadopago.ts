import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { criarCobrancaInterna } from "@/lib/cobrancaMercadoPago.functions";

// Roda uma vez por dia via pg_cron (ver
// supabase/migrations/20260727180000_mercadopago_marketplace_cobrancas.sql).
// Para cada tenant que ligou "cobrança automática" (Fase 3 parte 2 do
// módulo Financeiro), gera a cobrança via Mercado Pago pras parcelas de
// venda e lançamentos de locação que vencem dentro da janela configurada
// (cobranca_automatica_dias_antes) e ainda não têm cobrança pendente —
// reaproveita a mesma lógica de criação do botão manual (criarCobrancaInterna).

function addDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

type Alvo = { origemTipo: "parcela" | "lancamento"; origemId: string; tenantId: string };

async function buscarAlvos(tenantId: string, diasAntes: number): Promise<Alvo[]> {
  const limite = addDiasISO(diasAntes);
  const alvos: Alvo[] = [];

  const { data: parcelas } = await (supabaseAdmin as any)
    .from("contrato_parcelas")
    .select("id,contrato_id,contratos!inner(status,tipo)")
    .eq("tenant_id", tenantId)
    .in("status", ["pendente", "atrasado"])
    .lte("data_vencimento", limite)
    .eq("contratos.status", "ativo")
    .eq("contratos.tipo", "venda")
    .limit(200);
  for (const p of parcelas ?? []) {
    alvos.push({ origemTipo: "parcela", origemId: p.id, tenantId });
  }

  const { data: lancamentos } = await (supabaseAdmin as any)
    .from("lancamentos_financeiros")
    .select("id,contrato_id,contratos!inner(status,tipo)")
    .eq("tenant_id", tenantId)
    .eq("tipo", "receita")
    .in("status", ["pendente", "atrasado"])
    .lte("data_vencimento", limite)
    .not("contrato_id", "is", null)
    .eq("contratos.status", "ativo")
    .eq("contratos.tipo", "locacao")
    .limit(200);
  for (const l of lancamentos ?? []) {
    alvos.push({ origemTipo: "lancamento", origemId: l.id, tenantId });
  }

  // Descarta o que já tem cobrança pendente — evita chamar a API do Mercado
  // Pago à toa (criarCobrancaInterna também bloqueia isso, mas filtrar aqui
  // evita erro previsível em massa no laço abaixo).
  if (alvos.length === 0) return alvos;
  const { data: existentes } = await (supabaseAdmin as any)
    .from("cobrancas_mercadopago")
    .select("origem_tipo,origem_id")
    .eq("tenant_id", tenantId)
    .eq("status", "pendente");
  const jaTemCobranca = new Set(
    (existentes ?? []).map((e: any) => `${e.origem_tipo}:${e.origem_id}`),
  );
  return alvos.filter((a) => !jaTemCobranca.has(`${a.origemTipo}:${a.origemId}`));
}

export const Route = createFileRoute("/api/public/cron/gerar-cobrancas-mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: contas } = await (supabaseAdmin as any)
          .from("tenant_mercadopago_accounts")
          .select("tenant_id,cobranca_automatica_dias_antes")
          .eq("cobranca_automatica_ativa", true);

        let criadas = 0;
        const erros: string[] = [];

        for (const conta of contas ?? []) {
          try {
            const alvos = await buscarAlvos(
              conta.tenant_id,
              conta.cobranca_automatica_dias_antes ?? 3,
            );
            for (const alvo of alvos) {
              try {
                await criarCobrancaInterna({
                  tenantId: alvo.tenantId,
                  origemTipo: alvo.origemTipo,
                  origemId: alvo.origemId,
                  criadoPor: null,
                });
                criadas++;
              } catch (err: any) {
                erros.push(`${alvo.origemTipo}:${alvo.origemId}: ${err.message}`);
              }
            }
          } catch (err: any) {
            console.error(
              "[cron/gerar-cobrancas-mercadopago] falha ao buscar alvos",
              conta.tenant_id,
              err,
            );
            erros.push(`tenant ${conta.tenant_id}: ${err.message}`);
          }
        }

        return Response.json({
          ok: erros.length === 0,
          tenantsProcessados: (contas ?? []).length,
          criadas,
          ...(erros.length > 0 ? { erros } : {}),
        });
      },
    },
  },
});
