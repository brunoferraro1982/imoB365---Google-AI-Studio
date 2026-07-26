// Núcleo da automação de inadimplência: marca lançamentos vencidos como
// 'atrasado'. Usado tanto pelo botão "Verificar agora" (server function
// autenticada, respeitando RLS — escrita em lancamentos_financeiros ainda
// exige role admin, mesma regra já em vigor pra edição manual) quanto pelo
// endpoint /api/public/cron (service role, todos os tenants) — ver
// src/lib/inadimplencia.functions.ts e
// src/routes/api.public.cron.inadimplencia.ts.

export interface InadimplenciaSupabaseClient {
  from: (table: string) => any;
}

export type MarcarAtrasadosResult = { marcados: number };

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function marcarAtrasados(
  client: InadimplenciaSupabaseClient,
  opts?: { tenantId?: string },
): Promise<MarcarAtrasadosResult> {
  let query = client
    .from("lancamentos_financeiros")
    .update({ status: "atrasado" })
    .eq("status", "pendente")
    .lt("data_vencimento", hojeISO())
    .select("id");
  if (opts?.tenantId) query = query.eq("tenant_id", opts.tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return { marcados: data?.length ?? 0 };
}
