// Núcleo da geração mensal de repasse ao proprietário: cria uma linha em
// locacao_repasses pro mês corrente pra cada contrato de locação ativo que
// ainda não tem repasse gerado nesse mês. Usado tanto pelo botão "Gerar
// agora" (server function autenticada, respeitando RLS) quanto pelo
// endpoint /api/public/cron (service role, todos os tenants) — mesmo
// padrão já usado em src/lib/slaAlertas.ts.

// Subconjunto mínimo do client do supabase-js usado aqui, para aceitar tanto
// o client autenticado (RLS) quanto o supabaseAdmin (service role) sem
// acoplar a um tipo de Database específico.
export interface RepasseSupabaseClient {
  from: (table: string) => any;
}

export type GerarRepassesResult = { criados: number; jaExistiam: number };

function primeiroDiaDoMes(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function gerarRepassesDoMes(
  client: RepasseSupabaseClient,
  opts?: { tenantId?: string },
): Promise<GerarRepassesResult> {
  const mesReferencia = primeiroDiaDoMes();

  let query = client
    .from("contratos")
    .select("id,tenant_id,valor")
    .eq("tipo", "locacao")
    .eq("status", "ativo")
    .limit(500);
  if (opts?.tenantId) query = query.eq("tenant_id", opts.tenantId);
  const { data: contratos, error: contratosError } = await query;
  if (contratosError) throw contratosError;

  let criados = 0;
  let jaExistiam = 0;

  for (const c of contratos ?? []) {
    const { data: existente, error: existenteError } = await client
      .from("locacao_repasses")
      .select("id")
      .eq("contrato_id", c.id)
      .eq("mes_referencia", mesReferencia)
      .limit(1);
    if (existenteError) throw existenteError;
    if (existente && existente.length > 0) {
      jaExistiam++;
      continue;
    }

    // taxa_admin/outros_descontos ficam 0 na geração automática — não existe
    // hoje um campo de "taxa de administração padrão" no contrato ou no
    // tenant; o financeiro ajusta por repasse antes de marcar como recebido/
    // repassado (mesmo espírito do valor sugerido-mas-editável já usado em
    // ComissaoForm.tsx).
    const valorAluguel = Number(c.valor) || 0;
    const { error } = await client.from("locacao_repasses").insert({
      tenant_id: c.tenant_id,
      contrato_id: c.id,
      mes_referencia: mesReferencia,
      valor_aluguel: valorAluguel,
      taxa_admin_percentual: 0,
      taxa_admin_valor: 0,
      outros_descontos: 0,
      valor_repasse: valorAluguel,
      status: "pendente",
    });
    if (error) console.error("[gerarRepassesDoMes] falha ao criar repasse", c.id, error);
    else criados++;
  }

  return { criados, jaExistiam };
}
