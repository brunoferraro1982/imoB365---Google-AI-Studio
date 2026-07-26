import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const onboardingInput = z.object({
  nome: z.string().min(1),
  telefone: z.string().optional(),
  tipo: z.enum(["corretor", "imobiliaria"]),
  creci: z.string().optional(),
  cnpj: z.string().optional(),
  imobiliariaNome: z.string().optional(),
  modulosInteresse: z.array(z.string()).min(1),
  cidadesAtuacao: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
  regiaoAtuacao: z.string().trim().max(120).optional(),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(onboardingInput)
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("tipo_usuario, aprovado, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.tipo_usuario && existing?.aprovado && existing?.tenant_id) {
      return { success: true, already: true };
    }

    const modulesCSV = data.modulosInteresse.join(",");

    // upsert (não update): se a linha em profiles nunca existiu — por
    // exemplo, o trigger de criação automática no signup não disparou —
    // um update() aqui afetaria silenciosamente 0 linhas, sem erro, e o
    // onboarding pareceria concluído com sucesso sem nada persistido.
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        nome: data.nome,
        telefone: data.telefone || null,
        tipo_usuario: data.tipo,
        plano_pretendido: modulesCSV,
        imobiliaria_nome: data.tipo === "imobiliaria" ? data.imobiliariaNome || null : null,
      },
      { onConflict: "id" },
    );

    if (profileError) throw new Error("Erro ao atualizar perfil: " + profileError.message);

    const metaUpdate: Record<string, unknown> = {
      modulos_interesse: data.modulosInteresse,
    };
    if (data.tipo === "corretor" && data.creci) metaUpdate.creci = data.creci;
    if (data.tipo === "imobiliaria" && data.cnpj) metaUpdate.cnpj = data.cnpj;

    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: metaUpdate });

    const { data: result, error: rpcError } = await supabaseAdmin.rpc("provision_trial_business", {
      p_user_id: userId,
      p_nome: data.nome,
      p_tipo: data.tipo,
      p_imob_nome: data.tipo === "imobiliaria" ? data.imobiliariaNome || null : null,
    });

    if (rpcError) throw new Error("Erro ao provisionar trial: " + rpcError.message);

    const tenantId = (result as { tenant_id?: string } | null)?.tenant_id;
    if (tenantId && (data.cidadesAtuacao?.length || data.regiaoAtuacao)) {
      // Não derruba o onboarding em caso de erro — tenant/role/módulos já
      // foram provisionados com sucesso; área de atuação é enriquecimento
      // opcional, editável depois no assistente de site.
      const { error: areaError } = await supabaseAdmin
        .from("tenants")
        .update({
          cidades_atuacao: data.cidadesAtuacao?.length ? data.cidadesAtuacao : null,
          regiao_atuacao: data.regiaoAtuacao || null,
        })
        .eq("id", tenantId);
      if (areaError) console.error("Erro ao salvar área de atuação:", areaError.message);
    }

    return { success: true, trial: result };
  });

const clientSignupInput = z.object({
  nome: z.string().min(1),
});

// Cadastro de cliente final (comprador/locatário) — deliberadamente sem
// nenhum dos passos de completeOnboarding acima: não pede CRECI/CNPJ, não
// chama provision_trial_business (não cria tenant nem user_roles). Mesmo
// padrão de mercado das plataformas de referência (Zillow, Redfin,
// QuintoAndar, VivaReal): virar "profissional" é sempre um fluxo separado
// e posterior (aqui, completeOnboarding em si, acessível depois via
// "Anunciar Imóvel"), nunca uma etapa obrigatória do cadastro básico.
export const registerAsClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(clientSignupInput)
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("tipo_usuario, aprovado")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.tipo_usuario) {
      // Já tem tipo definido (cliente, corretor ou imobiliária) — idempotente,
      // não sobrescreve um perfil profissional existente.
      return { success: true, already: true };
    }

    const { error } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        nome: data.nome,
        tipo_usuario: "cliente",
        aprovado: true,
      },
      { onConflict: "id" },
    );

    if (error) throw new Error("Erro ao concluir cadastro: " + error.message);

    return { success: true };
  });
