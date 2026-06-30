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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        telefone: data.telefone || null,
        tipo_usuario: data.tipo,
        plano_pretendido: modulesCSV,
        imobiliaria_nome: data.tipo === "imobiliaria" ? data.imobiliariaNome || null : null,
      })
      .eq("id", userId);

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

    return { success: true, trial: result };
  });
