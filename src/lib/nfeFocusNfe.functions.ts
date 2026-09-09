import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Emissão de NFS-e via Focus NFe — BYO simplificado (API key, não OAuth).
// Confirmado direto na documentação oficial (doc.focusnfe.com.br) que a
// autenticação é HTTP Basic Auth com o token como usuário e senha vazia
// (RFC 7617), e que a emissão é assíncrona: POST cria a nota com status
// "processando_autorizacao", só um GET de consulta posterior confirma
// "autorizado" (com o link do PDF) ou "erro_autorizacao". Nenhum webhook
// foi confirmado na documentação consultada — por isso o fluxo daqui
// depende de consulta manual/poll, não de notificação automática.

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function focusNfeBaseUrl(ambiente: string): string {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br/v2"
    : "https://homologacao.focusnfe.com.br/v2";
}

async function focusNfeFetch(
  ambiente: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<any> {
  const basic = base64Encode(new TextEncoder().encode(`${token}:`));
  const res = await fetch(`${focusNfeBaseUrl(ambiente)}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

async function requireTenantAdmin(supabase: any, userId: string, tenantId: string) {
  const [{ data: isAdmin }, { data: isFinanceiro }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role_in_tenant", { _user_id: userId, _tenant_id: tenantId, _role: "admin" }),
    supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: tenantId,
      _role: "financeiro",
    }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isFinanceiro && !isSuper) {
    throw new Error("Apenas administradores/financeiro podem gerenciar a emissão de notas fiscais");
  }
}

export type NfeConfigStatus = {
  configured: boolean;
  ambiente: "homologacao" | "producao";
  ativo: boolean;
};

export const getNfeConfigStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NfeConfigStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_nfe_config")
      .select("token,ambiente,ativo")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      configured: !!data?.token,
      ambiente: (data?.ambiente as "homologacao" | "producao") ?? "homologacao",
      ativo: !!data?.ativo,
    };
  });

const salvarNfeConfigSchema = z.object({
  token: z.string().trim().min(10, "Token inválido").max(200),
  ambiente: z.enum(["homologacao", "producao"]),
  cnpjPrestador: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos, sem pontuação"),
  inscricaoMunicipal: z.string().trim().min(1).max(30),
  codigoMunicipioIbge: z
    .string()
    .trim()
    .regex(/^\d{7}$/, "Código IBGE do município deve ter 7 dígitos"),
  itemListaServico: z.string().trim().min(1).max(10),
  optanteSimplesNacional: z.boolean(),
  ativo: z.boolean(),
});

export const salvarNfeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarNfeConfigSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any).from("tenant_nfe_config").upsert(
      {
        tenant_id: tenantId,
        provider: "focus_nfe",
        token: data.token,
        ambiente: data.ambiente,
        cnpj_prestador: data.cnpjPrestador,
        inscricao_municipal: data.inscricaoMunicipal,
        codigo_municipio_ibge: data.codigoMunicipioIbge,
        item_lista_servico: data.itemListaServico,
        optante_simples_nacional: data.optanteSimplesNacional,
        ativo: data.ativo,
        created_by: userId,
      },
      { onConflict: "tenant_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const removerNfeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_nfe_config")
      .delete()
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const emitirNotaSchema = z.object({
  comissaoId: z.string().uuid().optional(),
  valorServicos: z.number().positive(),
  discriminacao: z.string().trim().min(5).max(2000),
  tomadorNome: z.string().trim().min(2).max(115),
  tomadorDocumento: z
    .string()
    .trim()
    .regex(/^\d{11}$|^\d{14}$/, "Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos)"),
  tomadorEmail: z.string().trim().email().max(80).optional().or(z.literal("")),
});

// Emite uma NFS-e de verdade pela conta Focus NFe do próprio tenant.
// Assíncrono do lado do Focus NFe — grava a nota como
// "processando_autorizacao" e devolve a referência; o status final
// (autorizado/erro) só vem numa consulta posterior (consultarNotaFiscal).
export const emitirNotaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => emitirNotaSchema.parse(d))
  .handler(
    async ({ data, context }): Promise<{ id: string; referencia: string; status: string }> => {
      const { supabase, userId } = context;
      const tenantId = await resolveTenantId(supabase, userId);
      await requireTenantAdmin(supabase, userId, tenantId);

      const { data: config } = await (supabaseAdmin as any)
        .from("tenant_nfe_config")
        .select(
          "token,ambiente,ativo,cnpj_prestador,inscricao_municipal,codigo_municipio_ibge,item_lista_servico,optante_simples_nacional",
        )
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!config?.token || !config?.ativo) {
        throw new Error(
          "Conecte e ative sua conta Focus NFe antes de emitir (Configurações → Nota Fiscal).",
        );
      }

      const referencia = `imob365-${tenantId.slice(0, 8)}-${Date.now()}`;
      const isCnpjTomador = data.tomadorDocumento.length === 14;

      const payload = {
        data_emissao: new Date().toISOString(),
        natureza_operacao: "1",
        optante_simples_nacional: config.optante_simples_nacional,
        prestador: {
          cnpj: config.cnpj_prestador,
          inscricao_municipal: config.inscricao_municipal,
        },
        tomador: {
          [isCnpjTomador ? "cnpj" : "cpf"]: data.tomadorDocumento,
          razao_social: data.tomadorNome,
          ...(data.tomadorEmail ? { email: data.tomadorEmail } : {}),
        },
        servico: {
          valor_servicos: data.valorServicos,
          iss_retido: false,
          item_lista_servico: config.item_lista_servico,
          discriminacao: data.discriminacao,
          codigo_municipio: config.codigo_municipio_ibge,
        },
      };

      const { ok, status, json } = await focusNfeFetch(
        config.ambiente,
        config.token,
        `/nfse?ref=${encodeURIComponent(referencia)}`,
        { method: "POST", body: JSON.stringify(payload) },
      );

      const statusFocus = json?.status ?? (ok ? "processando_autorizacao" : "erro_autorizacao");
      const mensagemErro = !ok
        ? (json?.erros ?? []).map((e: any) => e.mensagem).join("; ") ||
          json?.mensagem ||
          `Falha ao emitir nota fiscal (${status})`
        : null;

      const { data: registro, error } = await (supabaseAdmin as any)
        .from("nfe_emitidas")
        .insert({
          tenant_id: tenantId,
          comissao_id: data.comissaoId ?? null,
          referencia,
          status: statusFocus,
          valor_servicos: data.valorServicos,
          tomador_nome: data.tomadorNome,
          tomador_documento: data.tomadorDocumento,
          erro_mensagem: mensagemErro,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (!ok) throw new Error(mensagemErro ?? "Falha ao emitir nota fiscal");

      return { id: registro.id, referencia, status: statusFocus };
    },
  );

const consultarNotaSchema = z.object({ nfeId: z.string().uuid() });

export const consultarNotaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => consultarNotaSchema.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ status: string; numero: string | null; urlDanfse: string | null }> => {
      const { supabase, userId } = context;
      const tenantId = await resolveTenantId(supabase, userId);

      const { data: registro } = await (supabaseAdmin as any)
        .from("nfe_emitidas")
        .select("id,referencia")
        .eq("id", data.nfeId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!registro) throw new Error("Nota fiscal não encontrada.");

      const { data: config } = await (supabaseAdmin as any)
        .from("tenant_nfe_config")
        .select("token,ambiente")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!config?.token) throw new Error("Configuração de NFe não encontrada.");

      const { ok, json } = await focusNfeFetch(
        config.ambiente,
        config.token,
        `/nfse/${encodeURIComponent(registro.referencia)}`,
      );
      if (!ok) throw new Error(json?.mensagem ?? "Falha ao consultar status da nota fiscal.");

      const mensagemErro =
        json.status === "erro_autorizacao"
          ? (json.erros ?? []).map((e: any) => e.mensagem).join("; ")
          : null;

      await (supabaseAdmin as any)
        .from("nfe_emitidas")
        .update({
          status: json.status,
          numero: json.numero ?? null,
          url_danfse: json.url_danfse ?? null,
          erro_mensagem: mensagemErro,
        })
        .eq("id", registro.id);

      return {
        status: json.status,
        numero: json.numero ?? null,
        urlDanfse: json.url_danfse ?? null,
      };
    },
  );

const listarNotasSchema = z.object({ comissaoId: z.string().uuid() });

export const listarNotasFiscaisDaComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listarNotasSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data: notas } = await (supabaseAdmin as any)
      .from("nfe_emitidas")
      .select("id,status,numero,url_danfse,valor_servicos,tomador_nome,erro_mensagem,created_at")
      .eq("tenant_id", tenantId)
      .eq("comissao_id", data.comissaoId)
      .order("created_at", { ascending: false });

    return notas ?? [];
  });
