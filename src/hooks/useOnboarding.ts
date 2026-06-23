import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
};

type OnboardingState = {
  loading: boolean;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
  dismiss: () => Promise<void>;
};

export function useOnboarding(tenantId: string | null): OnboardingState {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    (async () => {
      setLoading(true);

      const [{ data: tenant }, { count: corretores }, { count: imoveis }] = await Promise.all([
        supabase
          .from("tenants")
          .select("nome, cnpj, creci_juridico, tema, dominio_proprio, onboarding_dismissed_at")
          .eq("id", tenantId)
          .single(),
        supabase
          .from("corretores")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("ativo", true),
        supabase
          .from("imoveis")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "ativo"),
      ]);

      if (tenant?.onboarding_dismissed_at) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      const tema = (tenant?.tema as Record<string, unknown>) ?? {};
      const hasLogo = Boolean(tema.logo_url);
      const hasCadastro = Boolean(tenant?.cnpj || tenant?.creci_juridico);
      const hasEquipe = (corretores ?? 0) > 0;
      const hasImovel = (imoveis ?? 0) > 0;
      const allDone = hasLogo && hasCadastro && hasEquipe && hasImovel;

      setSteps([
        {
          id: "identity",
          label: "Identidade visual",
          description: "Adicione logo e cores da sua marca",
          done: hasLogo,
          href: "/app/configuracoes/branding",
        },
        {
          id: "cadastro",
          label: "Dados cadastrais",
          description: "Informe CNPJ ou CRECI jurídico da imobiliária",
          done: hasCadastro,
          href: "/app/configuracoes/imobiliaria",
        },
        {
          id: "equipe",
          label: "Adicionar corretor",
          description: "Cadastre o primeiro corretor da equipe",
          done: hasEquipe,
          href: "/app/corretores/novo",
        },
        {
          id: "primeiro_imovel",
          label: "Primeiro imóvel",
          description: "Publique o primeiro imóvel no portfólio",
          done: hasImovel,
          href: "/app/imoveis/novo",
        },
        {
          id: "golive",
          label: "Go-live",
          description: "Revise e publique seu site white-label",
          done: allDone,
          href: "/app/configuracoes/golive",
        },
      ]);

      setLoading(false);
    })();
  }, [tenantId]);

  async function dismiss() {
    if (!tenantId) return;
    await supabase
      .from("tenants")
      .update({ onboarding_dismissed_at: new Date().toISOString() } as never)
      .eq("id", tenantId);
    setDismissed(true);
  }

  const completedCount = steps.filter((s) => s.done).length;

  return { loading, steps, completedCount, totalCount: steps.length, dismissed, dismiss };
}
