import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// CLM Sprint 10 — Regras de Negócio: hoje contrato é gravado 100% direto do
// client (ContratoForm.tsx), sem Zod, sem bloqueio nenhum — dá pra ativar um
// contrato sem imóvel/corretor/parte nenhuma. Usa o client `supabase`
// (contexto da própria sessão do usuário, RLS continua sendo a autoridade de
// quem pode escrever em qual tenant) — este arquivo só adiciona regras de
// negócio EM CIMA da RLS, não a substitui.

const CONTRATO_TIPOS = [
  "venda",
  "locacao",
  "permuta",
  "outro",
  "parceria",
  "administracao",
  "prestacao_servico",
  "exclusividade",
  "captacao",
] as const;
const CONTRATO_STATUS = ["rascunho", "ativo", "encerrado", "cancelado", "rescindido"] as const;

const contratoPayload = z.object({
  tenant_id: z.string().uuid(),
  numero: z.string().trim().max(60).nullable(),
  tipo: z.enum(CONTRATO_TIPOS),
  status: z.enum(CONTRATO_STATUS),
  valor: z.number().nonnegative(),
  comissao_percentual: z.number().nullable(),
  comissao_valor: z.number().nullable(),
  data_inicio: z.string().nullable(),
  data_fim: z.string().nullable(),
  observacoes: z.string().nullable(),
  imovel_id: z.string().uuid({ message: "Selecione um imóvel para o contrato" }),
  lead_id: z.string().uuid().nullable(),
  corretor_id: z.string().uuid({ message: "Selecione o corretor responsável" }),
  valor_sinal: z.number().nullable(),
  valor_entrada: z.number().nullable(),
  numero_parcelas: z.number().int().nullable(),
  data_primeira_parcela: z.string().nullable(),
  carencia_dias: z.number().int().nullable(),
  renovacao_automatica: z.boolean(),
  quantidade_renovacoes: z.number().int(),
  prazo_aviso_previo_dias: z.number().int().nullable(),
  prazo_rescisao_dias: z.number().int().nullable(),
  prazo_entrega_dias: z.number().int().nullable(),
  valor_condominio: z.number().nullable(),
  valor_iptu: z.number().nullable(),
  valor_seguro: z.number().nullable(),
  dia_vencimento: z.number().int().nullable(),
  centro_custo_id: z.string().uuid().nullable(),
});

export const criarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(contratoPayload)
  .handler(async ({ context, data }) => {
    const { data: contrato, error } = await context.supabase
      .from("contratos")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: contrato.id as string };
  });

export const atualizarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(contratoPayload.extend({ contrato_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { contrato_id, ...payload } = data;

    // Regra: não permitir rescisão com pendências (checklist obrigatório
    // incompleto) — quem rescinde precisa ter fechado a papelada primeiro.
    if (payload.status === "rescindido") {
      const { count } = await context.supabase
        .from("contrato_checklist")
        .select("id", { count: "exact", head: true })
        .eq("contrato_id", contrato_id)
        .eq("obrigatorio", true)
        .eq("concluido", false);
      if ((count ?? 0) > 0) {
        throw new Error(
          `Não é possível rescindir: ${count} item(ns) obrigatório(s) do checklist ainda pendente(s).`,
        );
      }
    }

    // Regra: não permitir renovação com inadimplência — só verifica quando o
    // número de renovações está de fato subindo (evita bloquear updates que
    // não têm nada a ver com renovar, ex. corrigir um typo na observação).
    const { data: atual } = await context.supabase
      .from("contratos")
      .select("quantidade_renovacoes")
      .eq("id", contrato_id)
      .maybeSingle();
    if (atual && payload.quantidade_renovacoes > (atual.quantidade_renovacoes ?? 0)) {
      const { count } = await context.supabase
        .from("lancamentos_financeiros")
        .select("id", { count: "exact", head: true })
        .eq("contrato_id", contrato_id)
        .eq("status", "atrasado");
      if ((count ?? 0) > 0) {
        throw new Error(
          "Não é possível renovar: existem lançamentos financeiros em atraso para este contrato.",
        );
      }
    }

    const { error } = await context.supabase
      .from("contratos")
      .update(payload)
      .eq("id", contrato_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mapeia o papel que representa o "dono"/parte-forte do contrato por tipo —
// só faz sentido pros tipos com uma contraparte clara (compra/venda e
// locação); parceria/prestação de serviço/outro não têm um papel canônico
// de "proprietário" no enum atual, então não são bloqueados por essa regra.
const PAPEL_PROPRIETARIO: Partial<Record<(typeof CONTRATO_TIPOS)[number], "vendedor" | "locador">> =
  {
    venda: "vendedor",
    permuta: "vendedor",
    exclusividade: "vendedor",
    captacao: "vendedor",
    locacao: "locador",
    administracao: "locador",
  };

export const ativarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ tenant_id: z.string().uuid(), contrato_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { tenant_id, contrato_id } = data;

    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select("tipo, imovel_id, corretor_id, etapa_atual, assinatura_status")
      .eq("id", contrato_id)
      .maybeSingle();
    if (contratoError) throw new Error(contratoError.message);
    if (!contrato) throw new Error("Contrato não encontrado");

    if (contrato.etapa_atual !== "assinatura") {
      throw new Error(
        `Não é possível ativar a partir da etapa atual ("${contrato.etapa_atual}") — o contrato precisa estar em "Assinatura".`,
      );
    }
    if (!contrato.imovel_id)
      throw new Error("Contrato sem imóvel vinculado — não pode ser ativado.");
    if (!contrato.corretor_id)
      throw new Error("Contrato sem corretor responsável — não pode ser ativado.");

    const papelProprietario = PAPEL_PROPRIETARIO[contrato.tipo as (typeof CONTRATO_TIPOS)[number]];
    if (papelProprietario) {
      const { count } = await supabase
        .from("contrato_partes")
        .select("id", { count: "exact", head: true })
        .eq("contrato_id", contrato_id)
        .eq("papel", papelProprietario);
      if ((count ?? 0) === 0) {
        throw new Error(
          `É necessário cadastrar ao menos uma parte com o papel adequado ("${papelProprietario}") antes de ativar.`,
        );
      }
    }

    if (contrato.tipo === "locacao" || contrato.tipo === "administracao") {
      const { count } = await supabase
        .from("locacao_garantias")
        .select("id", { count: "exact", head: true })
        .eq("contrato_id", contrato_id)
        .eq("ativo", true);
      if ((count ?? 0) === 0) {
        throw new Error("Cadastre ao menos uma garantia ativa antes de ativar este contrato.");
      }
    }

    const { count: checklistPendente } = await supabase
      .from("contrato_checklist")
      .select("id", { count: "exact", head: true })
      .eq("contrato_id", contrato_id)
      .eq("obrigatorio", true)
      .eq("concluido", false);
    if ((checklistPendente ?? 0) > 0) {
      throw new Error(
        `${checklistPendente} item(ns) obrigatório(s) do checklist ainda pendente(s) — conclua antes de ativar.`,
      );
    }

    // Assinatura eletrônica só é exigida quando o tenant de fato tem uma
    // integração BYO configurada e ativa — sem isso, o processo é
    // físico/offline (ver AssinaturaEletronicaPanel.tsx, Sprint 9) e não faz
    // sentido travar a ativação esperando um "assinado_total" que nunca vai
    // acontecer sozinho.
    const { data: assinaturaConfig } = await supabase
      .from("tenant_assinatura_config")
      .select("ativo")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    if (assinaturaConfig?.ativo && contrato.assinatura_status !== "assinado_total") {
      throw new Error(
        "Assinatura eletrônica ainda não concluída por todas as partes — não é possível ativar.",
      );
    }

    const { data: etapaAberta } = await supabase
      .from("contrato_etapas")
      .select("id")
      .eq("contrato_id", contrato_id)
      .eq("etapa", "assinatura")
      .is("concluida_em", null)
      .maybeSingle();
    const agora = new Date().toISOString();
    if (etapaAberta) {
      await supabase
        .from("contrato_etapas")
        .update({ concluida_em: agora })
        .eq("id", etapaAberta.id);
    }
    await supabase.from("contrato_etapas").insert({
      tenant_id,
      contrato_id,
      etapa: "ativacao",
      responsavel_user_id: context.userId,
    });
    const { error: updateError } = await supabase
      .from("contratos")
      .update({ etapa_atual: "ativacao" })
      .eq("id", contrato_id);
    if (updateError) throw new Error(updateError.message);

    // CLM Sprint 15 — Marketplace: ativação do contrato é o momento em que a
    // transação de fato se concretiza — imóvel sai de "reservado" (Sprint 3
    // do stepper) pro status final. Mesmo mapeamento de tipo já usado em
    // PAPEL_PROPRIETARIO acima; parceria/prestação de serviço/captação/
    // exclusividade/outro não têm um status final de imóvel associado.
    const statusFinalImovel: Record<string, string> = {
      venda: "vendido",
      permuta: "vendido",
      locacao: "alugado",
      administracao: "alugado",
    };
    const novoStatusImovel = statusFinalImovel[contrato.tipo];
    if (novoStatusImovel) {
      await supabase
        .from("imoveis")
        .update({ status: novoStatusImovel as never })
        .eq("id", contrato.imovel_id);
    }

    return { ok: true };
  });
