import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getVpsInfo, getVpsMetrics } from "@/integrations/hostinger/client.server";

export type HostingerPanelData = {
  configured: boolean;
  vm: Awaited<ReturnType<typeof getVpsInfo>>;
  metrics: Awaited<ReturnType<typeof getVpsMetrics>>;
};

// Painel de infraestrutura em /admin/status — métricas reais da VPS (CPU,
// RAM, disco) via API da Hostinger, direto a cada carregamento (a própria
// Hostinger já guarda o histórico, não precisamos duplicar em tabela nossa).
export const getHostingerPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HostingerPanelData> => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - 24 * 60 * 60 * 1000);

    const [vm, metrics] = await Promise.all([getVpsInfo(), getVpsMetrics(dateFrom, dateTo)]);

    return { configured: vm !== null && metrics !== null, vm, metrics };
  });
