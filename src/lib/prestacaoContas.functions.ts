import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  imovelId: z.string().uuid(),
  mesReferencia: z.string().regex(/^\d{4}-\d{2}-01$/),
});

export type PrestacaoContasData = {
  imovel: { id: string; titulo: string } | null;
  contrato: { id: string; numero: string | null } | null;
  repasse: {
    valor_aluguel: number;
    taxa_admin_percentual: number;
    taxa_admin_valor: number;
    outros_descontos: number;
    valor_repasse: number;
    status: string;
  } | null;
  despesas: {
    id: string;
    descricao: string;
    categoria: string | null;
    valor: number;
    data_vencimento: string;
  }[];
  despesas_total: number;
  liquido_final: number;
};

// Prestação de contas ao proprietário (Fase 1 item 4 do incremento do
// módulo Financeiro): consolida, por imóvel/mês, o aluguel repassado
// (locacao_repasses) com as despesas do próprio imóvel lançadas no período
// (lancamentos_financeiros.imovel_id) — hoje esses dois lados existiam
// separados, sem relatório que os juntasse.
export const getPrestacaoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<PrestacaoContasData> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      throw new Error("Usuário sem imobiliária vinculada");
    }

    const { data: imovel } = await supabase
      .from("imoveis")
      .select("id,titulo")
      .eq("id", data.imovelId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { data: contrato } = await supabase
      .from("contratos")
      .select("id,numero")
      .eq("imovel_id", data.imovelId)
      .eq("tenant_id", tenantId)
      .eq("tipo", "locacao")
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let repasse: PrestacaoContasData["repasse"] = null;
    if (contrato) {
      const { data: r } = await supabase
        .from("locacao_repasses")
        .select(
          "valor_aluguel,taxa_admin_percentual,taxa_admin_valor,outros_descontos,valor_repasse,status",
        )
        .eq("contrato_id", contrato.id)
        .eq("mes_referencia", data.mesReferencia)
        .maybeSingle();
      repasse = r ?? null;
    }

    const [ano, mes] = data.mesReferencia.split("-").map(Number);
    const fimDoMes = new Date(ano, mes, 0).toISOString().slice(0, 10);

    const { data: despesasRaw } = await supabase
      .from("lancamentos_financeiros")
      .select("id,descricao,categoria,valor,data_vencimento")
      .eq("tenant_id", tenantId)
      .eq("imovel_id", data.imovelId)
      .eq("tipo", "despesa")
      .gte("data_vencimento", data.mesReferencia)
      .lte("data_vencimento", fimDoMes);

    const despesas = despesasRaw ?? [];
    const despesas_total = despesas.reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const liquido_final = (repasse?.valor_repasse ?? 0) - despesas_total;

    return {
      imovel: imovel ?? null,
      contrato: contrato ?? null,
      repasse,
      despesas,
      despesas_total,
      liquido_final,
    };
  });

export type ImovelComLocacaoAtiva = { id: string; titulo: string };

// Lista de imóveis com contrato de locação ativo — alimenta o seletor da
// tela de prestação de contas.
export const listImoveisComLocacaoAtiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImovelComLocacaoAtiva[]> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return [];

    const { data, error } = await supabase
      .from("contratos")
      .select("imovel:imoveis(id,titulo)")
      .eq("tenant_id", tenantId)
      .eq("tipo", "locacao")
      .eq("status", "ativo")
      .not("imovel_id", "is", null);
    if (error) throw new Error(error.message);

    const seen = new Map<string, string>();
    for (const c of data ?? []) {
      const im = (c as any).imovel;
      if (im?.id && !seen.has(im.id)) seen.set(im.id, im.titulo ?? "Sem título");
    }
    return Array.from(seen.entries()).map(([id, titulo]) => ({ id, titulo }));
  });
