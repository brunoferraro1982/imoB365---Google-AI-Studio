import { supabase } from "@/integrations/supabase/client";
import type { EtapaChecklist } from "@/lib/checklistContratos";
import { analisarChecklist } from "@/lib/checklistStatus";

export type ItemModelo = {
  id?: string;
  etapa: EtapaChecklist | string;
  titulo: string;
  obrigatorio: boolean;
  ordem: number;
};

/**
 * Cria o modelo e os itens. Se os itens falharem, remove o modelo recém-criado,
 * para não deixar um modelo vazio ou pela metade.
 */
export async function criarModeloComItens(params: {
  tenantId: string;
  nome: string;
  tipo: string;
  itens: ItemModelo[];
}): Promise<{ id: string } | { erro: string }> {
  const { data: modelo, error: e1 } = await supabase
    .from("checklist_templates")
    .insert({ tenant_id: params.tenantId, nome: params.nome, tipo: params.tipo, ativo: true })
    .select("id")
    .single();
  if (e1 || !modelo) return { erro: e1?.message ?? "Falha ao criar o modelo" };

  if (params.itens.length > 0) {
    const { error: e2 } = await supabase.from("checklist_template_itens").insert(
      params.itens.map((i, idx) => ({
        tenant_id: params.tenantId,
        template_id: modelo.id,
        etapa: i.etapa,
        titulo: i.titulo,
        obrigatorio: i.obrigatorio,
        ordem: idx + 1,
      })),
    );
    if (e2) {
      await supabase.from("checklist_templates").delete().eq("id", modelo.id);
      return { erro: "Falha ao salvar os itens: " + e2.message };
    }
  }
  return { id: modelo.id };
}

/** Copia os itens de um modelo para um contrato. Não aplica se o contrato já tem itens. */
export async function aplicarModeloAoContrato(params: {
  tenantId: string;
  contratoId: string;
  modeloId: string;
}): Promise<{ quantidade: number } | { erro: string }> {
  const { count: jaTem, error: e0 } = await supabase
    .from("contrato_checklist")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", params.contratoId);
  if (e0) return { erro: "Não foi possível verificar o checklist: " + e0.message };
  if ((jaTem ?? 0) > 0) return { erro: "Este contrato já tem checklist." };
  const { data: itens, error: e1 } = await supabase
    .from("checklist_template_itens")
    .select("etapa,titulo,obrigatorio,ordem")
    .eq("template_id", params.modeloId)
    .order("ordem");
  if (e1) return { erro: "Não foi possível ler o modelo: " + e1.message };
  if (!itens?.length) return { erro: "Este modelo não tem itens." };

  const { error: e2 } = await supabase.from("contrato_checklist").insert(
    itens.map((i) => ({
      tenant_id: params.tenantId,
      contrato_id: params.contratoId,
      etapa: i.etapa,
      titulo: i.titulo,
      obrigatorio: i.obrigatorio,
      ordem: i.ordem,
    })),
  );
  if (e2) return { erro: "Não foi possível aplicar o modelo: " + e2.message };
  return { quantidade: itens.length };
}

/** Marca o modelo como padrão do seu tipo (desmarca o anterior, no banco). */
export async function definirModeloPadrao(
  modeloId: string,
): Promise<{ ok: true } | { erro: string }> {
  const { error } = await supabase.rpc("definir_checklist_padrao", { _template: modeloId });
  if (error) {
    const msg = error.message.includes("SEM_PERMISSAO")
      ? "Seu papel não pode definir o modelo padrão."
      : error.message;
    return { erro: msg };
  }
  return { ok: true };
}

export type SituacaoChecklist = {
  semChecklist: boolean;
  pendentesObrigatorios: number;
  etapasSemDocumento: string[];
};

/** Situação do checklist de cada contrato (uma consulta para a lista inteira). */
export async function buscarSituacaoChecklist(
  contratos: { id: string; etapa_atual: string }[],
): Promise<Map<string, SituacaoChecklist>> {
  const mapa = new Map<string, SituacaoChecklist>();
  const ids = contratos.map((c) => c.id);
  if (ids.length === 0) return mapa;
  const { data } = await supabase
    .from("contrato_checklist")
    .select("contrato_id,etapa,obrigatorio,concluido")
    .in("contrato_id", ids);
  const porContrato = new Map<
    string,
    { etapa: string; obrigatorio: boolean; concluido: boolean }[]
  >();
  for (const r of data ?? []) {
    porContrato.set(r.contrato_id, [
      ...(porContrato.get(r.contrato_id) ?? []),
      { etapa: r.etapa, obrigatorio: r.obrigatorio, concluido: r.concluido },
    ]);
  }
  for (const c of contratos) {
    const itens = porContrato.get(c.id) ?? [];
    const a = analisarChecklist(
      itens.map((i, idx) => ({ id: String(idx), titulo: "", ...i })),
      c.etapa_atual,
    );
    mapa.set(c.id, {
      semChecklist: a.semChecklist,
      pendentesObrigatorios: a.pendentesTotal,
      etapasSemDocumento: a.etapasSemDocumento,
    });
  }
  return mapa;
}
