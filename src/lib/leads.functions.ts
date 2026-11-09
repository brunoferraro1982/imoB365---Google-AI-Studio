import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const criarLeadManualSchema = z.object({
  tenant_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(200),
  email: z.string().trim().max(255).optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  imovel_id: z.string().uuid().optional().nullable(),
  corretor_id: z.string().uuid().optional().nullable(),
});

// Cadastro manual de lead direto no Kanban (/app/leads) — mesmo enum
// `lead_origem='manual'` já existente desde a criação da tabela, e mesmo
// padrão de round-robin + registro em lead_interacoes já usado pela RPC
// pública `public_create_lead` (formulário do site). `status` fica de fora
// do insert de propósito — o default do banco ('novo') já garante que o
// lead cai na primeira coluna do Kanban.
export const criarLeadManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => criarLeadManualSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: isBroker }, { data: isSuper }] = await Promise.all([
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenant_id,
        _role: "admin",
      }),
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenant_id,
        _role: "broker",
      }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isBroker && !isSuper) {
      throw new Error("Sem permissão para cadastrar leads nesta imobiliária.");
    }

    let corretorId = data.corretor_id ?? null;
    let atribuidoAutomaticamente = false;
    if (!corretorId) {
      const { data: assigned } = await supabase.rpc("assign_lead_round_robin", {
        _tenant_id: data.tenant_id,
      });
      corretorId = (assigned as string | null) ?? null;
      atribuidoAutomaticamente = !!corretorId;
    }

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        tenant_id: data.tenant_id,
        imovel_id: data.imovel_id || null,
        corretor_id: corretorId,
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        mensagem: data.mensagem || null,
        origem: "manual",
      } as never)
      .select("id")
      .single();
    if (leadErr) throw new Error(leadErr.message);

    const leadId = (lead as { id: string }).id;

    await supabase.from("lead_interacoes").insert({
      lead_id: leadId,
      tenant_id: data.tenant_id,
      tipo: "nota",
      conteudo: "Lead cadastrado manualmente no Kanban",
    } as never);

    if (atribuidoAutomaticamente && corretorId) {
      await supabase.from("lead_interacoes").insert({
        lead_id: leadId,
        tenant_id: data.tenant_id,
        tipo: "atribuicao",
        conteudo: "Atribuído automaticamente",
        metadata: { corretor_id: corretorId },
      } as never);
    }

    return { id: leadId };
  });
