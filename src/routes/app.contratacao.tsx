import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Check,
  Sparkles,
  ShoppingBag,
  ChevronRight,
  Package,
  CheckCircle,
  ShieldCheck,
  CheckSquare,
  Square,
  HelpCircle,
  Coins,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

type SearchParams = {
  plano_id?: string;
  plano?: string;
};

export const Route = createFileRoute("/app/contratacao")({
  validateSearch: (raw: Record<string, unknown>): SearchParams => ({
    plano_id: typeof raw.plano_id === "string" ? raw.plano_id : undefined,
    plano: typeof raw.plano === "string" ? raw.plano : undefined,
  }),
  component: ContratacaoPage,
});

function formatQuota(quota: number) {
  if (quota === -1) return "Ilimitado";
  return quota;
}

type Plan = {
  id: string;
  nome: string;
  slug: string;
  preco_mensal: number;
  limites: { imoveis?: number; modulos?: number; usuarios?: number } | null;
};

type Module = {
  slug: string;
  nome: string;
  descricao: string | null;
  versao: string;
  core: boolean;
  requires_plan: string | null;
  depends_on: string[];
};

function ContratacaoPage() {
  const { tenantId, isAdmin } = useAuth();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedModuleSlugs, setSelectedModuleSlugs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  // Dados de faturamento (usados manualmente pelo time comercial para emitir a nota —
  // não há gateway de pagamento integrado ainda, ver backlog no CLAUDE.md)
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");

  // Load plans & modules from Supabase
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [{ data: plansData }, { data: modulesData }, { data: tenantData }] =
          await Promise.all([
            supabase.from("plans").select("*").order("preco_mensal", { ascending: true }),
            supabase.from("modules").select("*").order("nome"),
            tenantId
              ? supabase.from("tenants").select("plano_slug").eq("id", tenantId).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        const typedPlans = (plansData as Plan[]) ?? [];
        const typedModules = (modulesData as Module[]) ?? [];

        setPlans(typedPlans);
        setModules(typedModules);

        // Pré-seleciona o plano ATUAL do tenant — nunca um índice arbitrário do array,
        // ou um usuário pode confirmar sem perceber e trocar de plano sem querer.
        let defaultPlan =
          typedPlans.find((p) => p.slug === tenantData?.plano_slug) ?? typedPlans[0] ?? undefined;
        if (searchParams.plano_id) {
          const match = typedPlans.find((p) => p.id === searchParams.plano_id);
          if (match) defaultPlan = match;
        } else if (searchParams.plano) {
          const match = typedPlans.find(
            (p) =>
              p.slug === searchParams.plano ||
              p.nome.toLowerCase() === searchParams.plano?.toLowerCase(),
          );
          if (match) defaultPlan = match;
        }

        if (defaultPlan) {
          setSelectedPlanId(defaultPlan.id);
        }

        // Initialize modules selection
        const initialSelected: Record<string, boolean> = {};
        typedModules.forEach((m) => {
          if (m.core) {
            initialSelected[m.slug] = true;
          }
        });

        // If there are existing enabled modules for this tenant
        if (tenantId) {
          const { data: tmData } = await supabase
            .from("tenant_modules")
            .select("module_slug,enabled")
            .eq("tenant_id", tenantId);

          if (tmData && tmData.length > 0) {
            tmData.forEach((row) => {
              if (row.enabled) {
                initialSelected[row.module_slug] = true;
              }
            });
          }
        }

        setSelectedModuleSlugs(initialSelected);
      } catch (err: any) {
        toast.error("Erro ao carregar dados de contratação: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, searchParams.plano_id, searchParams.plano]);

  const activePlan = useMemo(() => {
    return plans.find((p) => p.id === selectedPlanId);
  }, [plans, selectedPlanId]);

  // Calculations
  const quota = activePlan?.limites?.modulos ?? 0;
  const unlimited = quota === -1;

  const coreModules = useMemo(() => modules.filter((m) => m.core), [modules]);
  const optionalModules = useMemo(() => modules.filter((m) => !m.core), [modules]);

  const selectedOptionalCount = useMemo(() => {
    return optionalModules.filter((m) => selectedModuleSlugs[m.slug]).length;
  }, [optionalModules, selectedModuleSlugs]);

  const remainingQuota = useMemo(() => {
    if (unlimited) return Infinity;
    return Math.max(0, quota - selectedOptionalCount);
  }, [quota, unlimited, selectedOptionalCount]);

  // Custo por módulo extra de R$ 29/mês se exceder a cota do plano
  const extraModulesCount = useMemo(() => {
    if (unlimited) return 0;
    return Math.max(0, selectedOptionalCount - quota);
  }, [unlimited, selectedOptionalCount, quota]);

  const extraModulesCost = extraModulesCount * 29;

  const totalCost = useMemo(() => {
    const base = activePlan?.preco_mensal ?? 0;
    return base + extraModulesCost;
  }, [activePlan, extraModulesCost]);

  // Handle checking/unchecking optional module
  function toggleModule(slug: string) {
    setSelectedModuleSlugs((prev) => {
      const isCurrentlySelected = prev[slug];
      const newVal = !isCurrentlySelected;

      // Ensure core modules cannot be deselected
      const targetMod = modules.find((m) => m.slug === slug);
      if (targetMod?.core) return prev;

      return {
        ...prev,
        [slug]: newVal,
      };
    });
  }

  // Submit Contracting Flow
  async function handleContract(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      toast.error("Você precisa estar vinculado a um tenant para realizar contratações.");
      return;
    }
    if (!activePlan) {
      toast.error("Selecione um plano válido antes de contratar.");
      return;
    }
    if (!cnpjCpf.trim()) {
      toast.error("Insira o documento CPF ou CNPJ de faturamento.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update the tenant's plan slug in Supabase
      const { error: tenantErr } = await supabase
        .from("tenants")
        .update({
          plano_slug: activePlan.slug,
        })
        .eq("id", tenantId);

      if (tenantErr) throw tenantErr;

      // 2. Clear out older tenant_modules and insert the custom selection for the user!
      // Buscamos quais slugs de módulos realmente existem no banco para evitar violação de integridade referencial (foreign key fkey)
      const { data: dbModules } = await supabase.from("modules").select("slug");
      const dbSlugs = new Set(dbModules?.map((m) => m.slug) || []);

      const upsertPayload = modules
        .filter((m) => dbSlugs.has(m.slug))
        .map((m) => {
          const isEnabled = m.core || !!selectedModuleSlugs[m.slug];
          return {
            tenant_id: tenantId,
            module_slug: m.slug,
            enabled: isEnabled,
          };
        });

      const { error: modulesErr } = await supabase
        .from("tenant_modules")
        .upsert(upsertPayload, { onConflict: "tenant_id,module_slug" });

      if (modulesErr) throw modulesErr;

      setShowPaymentSuccess(true);
      toast.success("Plano e módulos atualizados com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao concluir contratação: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground font-semibold">
          Carregando canais de faturamento e módulos...
        </span>
      </div>
    );
  }

  if (showPaymentSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center animate-fade-in">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-6">
          <CheckCircle className="h-10 w-10 stroke-[2.5]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
          Plano atualizado!
        </h1>
        <p className="mt-3 text-muted-foreground font-medium text-base sm:text-lg">
          Os recursos do plano <strong className="text-foreground">{activePlan?.nome}</strong> e os
          módulos selecionados já estão ativos no seu painel. O faturamento correspondente é
          combinado diretamente com o time comercial da imob365.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-white dark:bg-card p-6 text-left shadow-lg max-w-lg mx-auto space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border/60">
            <span className="text-sm text-muted-foreground font-medium">Plano contratado</span>
            <span className="text-sm font-bold text-foreground bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wider">
              {activePlan?.nome}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground font-medium">Valor de referência</span>
            <span className="text-base font-extrabold text-foreground">
              {formatBRL(totalCost)}/mês
            </span>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3.5">
          <Button
            onClick={() => navigate({ to: "/app/configuracoes" })}
            size="lg"
            className="font-bold tracking-wide rounded-full text-white bg-primary hover:bg-[#d65e1b]"
          >
            Ver módulos ativos
          </Button>
          <Button
            onClick={() => navigate({ to: "/app" })}
            variant="outline"
            size="lg"
            className="font-bold tracking-wide rounded-full"
          >
            Ir para o Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* HEADER SECTION */}
      <header className="mb-8 pb-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="text-primary h-8 w-8" />
            Central de Contratação & Módulos
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground font-medium">
            Personalize seu catálogo de ferramentas. Altere seu plano base e ative apenas os
            recursos de que você precisa para acelerar suas vendas.
          </p>
        </div>
      </header>

      <form onSubmit={handleContract} className="grid gap-8 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: MODULE PLAN SELECTION AND OPTIONAL SERVICES (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          {/* STEP 1: SELECT PLAN BASE */}
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                Selecione o Plano Base
              </h2>
              <span className="text-xs text-muted-foreground font-semibold">
                Upgrade/Downgrade imediato
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {plans.map((p) => {
                const isSelected = p.id === selectedPlanId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all duration-200 outline-none ${
                      isSelected
                        ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/20"
                        : "border-border hover:border-border/80 hover:bg-neutral-50/40 hover:scale-[1.01]"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm font-bold truncate">{p.nome}</span>
                      {isSelected ? (
                        <span className="h-4.5 w-4.5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white stroke-[3px]" />
                        </span>
                      ) : (
                        <span className="h-4.5 w-4.5 rounded-full border border-border" />
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="text-lg font-extrabold">{formatBRL(p.preco_mensal)}</span>
                      <span className="text-xs text-muted-foreground">/mês</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 w-full text-[11px] text-muted-foreground space-y-1 font-medium">
                      <div className="flex justify-between">
                        <span>Cota de Imóveis:</span>
                        <span className="font-bold text-foreground">
                          {p.limites?.imoveis?.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Módulos inclusos:</span>
                        <span className="font-bold text-foreground">
                          {p.limites?.modulos === -1 ? "Ilimitados" : p.limites?.modulos}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT SERVICES & MODULES */}
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-border/40 pb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    2
                  </span>
                  Selecione os Serviços & Módulos Disponíveis
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ligue ou desligue módulos opcionais. O plano{" "}
                  <strong className="text-foreground">{activePlan?.nome}</strong> dá direito a{" "}
                  {unlimited ? "módulos ilimitados" : `até ${quota} módulos opcionais`}.
                </p>
              </div>

              {/* Status Indicator Bar */}
              <div className="bg-neutral-50 dark:bg-neutral-900 border border-border rounded-xl px-4 py-2 flex items-center justify-between gap-4 shrink-0 text-xs">
                <div>
                  <span className="text-muted-foreground">Módulos Usados:</span>{" "}
                  <strong className="text-foreground">{selectedOptionalCount}</strong>
                  <span className="text-muted-foreground"> / {formatQuota(quota)}</span>
                </div>
                {!unlimited && <div className="h-4.5 w-px bg-border/80" />}
                {!unlimited && (
                  <div>
                    {remainingQuota > 0 ? (
                      <span className="text-emerald-500 font-bold">
                        +{remainingQuota} extras inclusos
                      </span>
                    ) : extraModulesCount > 0 ? (
                      <span className="text-primary font-bold">
                        +{extraModulesCount} excedente (+R$ {extraModulesCost}/mês)
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium">Cota exata atingida</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Core Modules List (Static active) */}
            <div className="mb-6">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground flex items-center gap-1.5 mb-2.5">
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> Módulos Básicos Inclusos
                (Sempre Ativos)
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {coreModules.map((m) => (
                  <div
                    key={m.slug}
                    className="relative bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="mt-0.5 rounded-full bg-emerald-500/10 text-emerald-500 p-1 shrink-0">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                        {m.nome}
                      </h4>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {m.descricao}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Modules Grid Toggles */}
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground flex items-center gap-1.5 mb-3">
                <Package className="h-3 w-3 text-primary" /> Módulos Avançados Plugáveis (Opcionais)
              </span>

              <div className="grid gap-4.5 sm:grid-cols-2">
                {optionalModules.map((m) => {
                  const isChecked = !!selectedModuleSlugs[m.slug];
                  const overLimit = !unlimited && !isChecked && selectedOptionalCount >= quota;

                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => toggleModule(m.slug)}
                      className={`relative w-full border-2 text-left rounded-xl p-4 flex gap-4 transition-all duration-200 cursor-pointer select-none ${
                        isChecked
                          ? "border-primary bg-primary/[0.01] shadow-2xs"
                          : "border-border hover:border-border/80 hover:bg-neutral-50/20"
                      }`}
                    >
                      {/* Left icon checker */}
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="h-5 w-5 text-primary stroke-[2.25px]" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{m.nome}</h4>
                          {overLimit && (
                            <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Coins className="h-2.5 w-2.5 animate-bounce" /> + R$ 29/mês
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-normal">
                          {m.descricao}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/80 font-medium">
                          <span>Desenvolvimento: v{m.versao}</span>
                          {isChecked && (
                            <span className="text-primary font-bold">Ativado para contratação</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: DADOS PARA NOTA FISCAL */}
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                3
              </span>
              Dados para nota fiscal
            </h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Não processamos pagamento automático aqui ainda — ao confirmar, seu plano e módulos já
              entram em vigor, e nosso time comercial entra em contato para combinar o faturamento
              com base nesses dados.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cnpjCpf" className="font-bold flex items-center gap-1.5">
                  CPF ou CNPJ para Nota Fiscal
                </Label>
                <Input
                  id="cnpjCpf"
                  required
                  placeholder="00.000.000/0001-00 ou 000.000.000-00"
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(e.target.value)}
                  className="rounded-xl border-border/80 h-10.5 text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="razaoSocial" className="font-bold flex items-center gap-1.5">
                  Razão Social ou Nome Completo
                </Label>
                <Input
                  id="razaoSocial"
                  required
                  placeholder="Ex: Imobiliária Bairro Seguro LTDA"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className="rounded-xl border-border/80 h-10.5 text-sm font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECAP & CONFIRM BUTTON (4 COLS) */}
        <div className="lg:col-span-4 sticky top-24">
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-6 shadow-md space-y-5">
            <h3 className="text-base font-bold text-foreground border-b border-border/60 pb-3 flex items-center justify-between">
              <span>Resumo do Faturamento</span>
              <span className="text-xs text-muted-foreground font-semibold">Mensal</span>
            </h3>

            {/* Cost Recap List */}
            <div className="space-y-3.5 text-sm font-medium">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Plano Base ({activePlan?.nome}):</span>
                <span className="text-foreground font-bold">
                  {formatBRL(activePlan?.preco_mensal ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Módulos básicos inclusos:</span>
                <span className="text-emerald-500 font-bold">Grátis</span>
              </div>

              {extraModulesCount > 0 && (
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block">Módulos Excedentes:</span>
                    <span className="text-[11px] text-muted-foreground leading-none">
                      ({extraModulesCount} extras opcionais)
                    </span>
                  </div>
                  <span className="text-foreground font-bold">{formatBRL(extraModulesCost)}</span>
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-border/60" />

              <div className="flex justify-between items-end pt-1">
                <span className="text-base font-extrabold text-foreground">
                  Preço Total Mensal:
                </span>
                <div className="text-right">
                  <div className="text-2xl font-black text-primary">{formatBRL(totalCost)}</div>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    sem taxas fixas ou impostos adicionais
                  </span>
                </div>
              </div>
            </div>

            {/* List of services checked */}
            <div className="bg-neutral-50 dark:bg-neutral-900 border border-border/80 rounded-xl p-4.5 space-y-3">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground block mb-2.5">
                Arquitetura de Serviços Selecionada:
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {activePlan?.nome}{" "}
                  (Plano Principal)
                </div>
                {modules.map((m) => {
                  const isChecked = m.core || !!selectedModuleSlugs[m.slug];
                  if (!isChecked) return null;
                  return (
                    <div key={m.slug} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="truncate text-foreground/80">{m.nome}</span>
                      {m.core ? (
                        <span className="text-[9px] text-muted-foreground font-semibold">
                          {" "}
                          (Básico)
                        </span>
                      ) : (
                        <span className="text-[9px] text-primary font-semibold"> (Modular)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Checkout Action Button */}
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full font-black tracking-wide bg-gradient-to-r from-primary via-[#e86620] to-orange-500 text-white shadow-md hover:scale-[1.01] hover:shadow-lg active:scale-98 transition-all duration-300 h-12 rounded-xl flex items-center justify-center gap-2.5"
            >
              {submitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processando ativação...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span>Confirmar e Ativar Assinatura</span>
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground font-semibold max-w-xs mx-auto leading-normal">
              Ao assinar, você concorda com nossos Termos de Serviço e Política de Privacidade.
              Cancele ou altere sua estrutura a qualquer momento.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
