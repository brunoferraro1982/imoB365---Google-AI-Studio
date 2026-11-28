import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evolutionBaseUrlSchema,
  evolutionInstanceNameSchema,
  mascararChave,
  testarConexaoEvolution,
  type EvolutionCanalConfig,
  type EvolutionTestResult,
} from "@/integrations/evolution/client.server";

// Configuração do WhatsApp (Evolution API) por tenant. Reaproveita a linha de
// tenant_atendimento_canal_config (canal = 'whatsapp', mesmas chaves de config
// que enviarWhatsAppChamado já lê: instance_url, instance_name, api_key).
// tenant_id é SEMPRE derivado do usuário autenticado (profiles), nunca do cliente.
// Chave de API: gravada no servidor, nunca devolvida — só máscara.

export type WhatsAppEvolutionStatus = {
  configurado: boolean;
  ativo: boolean;
  instanceUrl: string;
  instanceName: string;
  apiKeyMascarada: string | null;
  numeroConectado: string | null;
  mensagemBoasVindas: string;
};

const salvarSchema = z.object({
  instanceUrl: evolutionBaseUrlSchema,
  instanceName: evolutionInstanceNameSchema,
  // Vazio = manter a chave já salva. Só é gravada uma nova quando informada.
  apiKey: z.string().trim().max(300).optional().or(z.literal("")),
  ativo: z.boolean(),
  mensagemBoasVindas: z
    .string()
    .trim()
    .max(1000, "Mensagem muito longa (máx. 1000 caracteres)")
    .optional()
    .or(z.literal("")),
});

async function resolveTenantId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id as string;
}

// Balcão de atendimento é admin-only (mesma regra da RLS tacc_admin).
async function requireTenantAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  tenantId: string,
) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role_in_tenant", { _user_id: userId, _tenant_id: tenantId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuper) {
    throw new Error("Apenas administradores podem configurar o WhatsApp");
  }
}

async function carregarLinhaCanal(tenantId: string) {
  const { data } = await supabaseAdmin
    .from("tenant_atendimento_canal_config")
    .select("config,ativo")
    .eq("tenant_id", tenantId)
    .eq("canal", "whatsapp")
    .maybeSingle();
  return {
    ativo: !!data?.ativo,
    config: (data?.config ?? {}) as EvolutionCanalConfig,
    existe: !!data,
  };
}

export const obterWhatsAppEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppEvolutionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { ativo, config } = await carregarLinhaCanal(tenantId);
    return {
      configurado: !!(config.instance_url && config.instance_name && config.api_key),
      ativo,
      instanceUrl: config.instance_url ?? "",
      instanceName: config.instance_name ?? "",
      apiKeyMascarada: mascararChave(config.api_key),
      numeroConectado: config.numero_conectado ?? null,
      mensagemBoasVindas: config.mensagem_boas_vindas ?? "",
    };
  });

export const salvarWhatsAppEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const atual = await carregarLinhaCanal(tenantId);
    const novaChave = data.apiKey ? data.apiKey : null;
    const chaveFinal = novaChave ?? atual.config.api_key ?? null;

    if (data.ativo && !chaveFinal) {
      throw new Error("Informe a chave de API antes de ativar o canal");
    }

    // Mescla com a config existente para não apagar campos de outros usos
    // (ex.: `numero`, que a tela de e-mail/WhatsApp legada também grava).
    const config: EvolutionCanalConfig = {
      ...atual.config,
      instance_url: data.instanceUrl,
      instance_name: data.instanceName,
      api_key: chaveFinal,
      mensagem_boas_vindas: data.mensagemBoasVindas ? data.mensagemBoasVindas : null,
      // Ao trocar de URL/instância, o número lido da instância anterior deixa de valer.
      numero_conectado:
        data.instanceUrl !== atual.config.instance_url ||
        data.instanceName !== atual.config.instance_name
          ? null
          : (atual.config.numero_conectado ?? null),
    };

    const { error } = await supabaseAdmin.from("tenant_atendimento_canal_config").upsert(
      {
        tenant_id: tenantId,
        canal: "whatsapp",
        ativo: data.ativo,
        config: config as unknown as Json,
      },
      { onConflict: "tenant_id,canal" },
    );
    if (error) throw new Error("Não foi possível salvar a configuração");

    return { ok: true };
  });

export const testarWhatsAppEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EvolutionTestResult> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { config } = await carregarLinhaCanal(tenantId);
    if (!config.instance_url || !config.instance_name || !config.api_key) {
      return { estado: "erro", mensagem: "Salve a URL, a instância e a chave antes de testar" };
    }

    // O teste usa a configuração salva no servidor (a chave nunca sai daqui).
    const resultado = await testarConexaoEvolution({
      baseUrl: config.instance_url,
      instanceName: config.instance_name,
      apiKey: config.api_key,
    });

    // Persiste o número lido (somente leitura na UI) quando a instância estiver conectada.
    if (resultado.estado === "conectado") {
      await supabaseAdmin
        .from("tenant_atendimento_canal_config")
        .update({
          config: { ...config, numero_conectado: resultado.numeroConectado } as unknown as Json,
        })
        .eq("tenant_id", tenantId)
        .eq("canal", "whatsapp");
    }

    return resultado;
  });
