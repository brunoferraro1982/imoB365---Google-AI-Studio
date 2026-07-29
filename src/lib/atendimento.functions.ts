import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Lista membros do tenant elegíveis a receber um chamado (pra montar o
 * seletor "Atribuir a"). Diferente de listTenantMembers (team.functions.ts,
 * admin-only), qualquer membro do próprio tenant pode chamar — é só leitura
 * de nome, não gerencia papel/convite de ninguém.
 */
export const listChamadoAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMember } = await supabase.rpc("is_member_of_tenant", {
      _user_id: userId,
      _tenant_id: data.tenantId,
    });
    if (!isMember) throw new Error("Sem permissão");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", data.tenantId)
      .in("role", ["admin", "atendente", "broker"]);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [] as { id: string; nome: string }[];

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,nome").in("id", ids);

    return (profiles ?? []).map((p) => ({ id: p.id, nome: p.nome ?? "Sem nome" }));
  });

const criarChamadoManualSchema = z.object({
  tenantId: z.string().uuid().nullable(),
  solicitanteNome: z.string().min(2).max(200),
  solicitanteEmail: z.string().max(255).optional(),
  solicitanteTelefone: z.string().max(40).optional(),
  categoria: z.enum([
    "problema_plataforma",
    "duvida_comercial",
    "reclamacao_anuncio",
    "financeiro_cobranca",
    "outro",
  ]),
  assunto: z.string().min(3).max(120),
  mensagemInicial: z.string().min(1).max(4000),
});

/**
 * Criação manual de chamado — cobre o caso de um atendimento que não veio
 * por nenhum canal automatizado (ex.: telefonema recebido, atendimento
 * presencial). `tenantId: null` cria no balcão imoB365 (exige
 * super_admin); com `tenantId`, cria no balcão daquele tenant (exige
 * admin/atendente do próprio tenant) — mesma regra de autorização já
 * usada em chamados_tenant_staff_insert/chamados_super_admin_all (RLS),
 * replicada aqui explicitamente porque o insert roda via supabaseAdmin
 * (service role, bypassa RLS) — a checagem de permissão precisa
 * acontecer no código, não pode depender só da RLS nesse caminho.
 */
export const criarChamadoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => criarChamadoManualSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let responsavelTipo: "tenant" | "imob365";
    if (data.tenantId) {
      const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenantId,
        _role: "admin",
      });
      const { data: isAtendente } = await supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenantId,
        _role: "atendente",
      });
      if (!isAdmin && !isAtendente) {
        throw new Error("Sem permissão pra criar chamado neste tenant");
      }
      responsavelTipo = "tenant";
    } else {
      const { data: isSuper } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "super_admin",
      });
      if (!isSuper) throw new Error("Sem permissão");
      responsavelTipo = "imob365";
    }

    const { data: chamado, error } = await supabaseAdmin
      .from("chamados")
      .insert({
        responsavel_tipo: responsavelTipo,
        tenant_id: data.tenantId,
        solicitante_tipo: "cliente_final",
        solicitante_nome: data.solicitanteNome,
        solicitante_email: data.solicitanteEmail || null,
        solicitante_telefone: data.solicitanteTelefone || null,
        categoria: data.categoria,
        canal_origem: "manual",
        assunto: data.assunto,
      } as never)
      .select("id,numero")
      .single();
    if (error || !chamado) {
      throw new Error(error?.message ?? "Erro ao criar chamado");
    }

    const chamadoRow = chamado as { id: string; numero: string };

    await supabaseAdmin.from("chamado_mensagens").insert({
      chamado_id: chamadoRow.id,
      autor_tipo: "agente",
      autor_user_id: userId,
      canal: "manual",
      conteudo: data.mensagemInicial,
    });

    return chamadoRow;
  });
