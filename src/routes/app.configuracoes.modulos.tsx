import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Package, Lock, Check, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatQuota } from "@/lib/format";

export const Route = createFileRoute("/app/configuracoes/modulos")({
  component: Modulos,
});

type Module = {
  slug: string;
  nome: string;
  descricao: string | null;
  versao: string;
  core: boolean;
  requires_plan: string | null;
  depends_on: string[];
};

function Modulos() {
  const { tenantId, isAdmin } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [planoSlug, setPlanoSlug] = useState<string | null>(null);
  const [planoNome, setPlanoNome] = useState<string | null>(null);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: mods }, { data: tm }, { data: tenant }] = await Promise.all([
      supabase.from("modules").select("*").order("nome"),
      supabase.from("tenant_modules").select("module_slug,enabled").eq("tenant_id", tenantId),
      supabase.from("tenants").select("plano_slug").eq("id", tenantId).maybeSingle(),
    ]);

    const typedMods = (mods as Module[]) ?? [];

    // Certifica de incluir o módulo de blog e widgets se eles não vierem do banco de dados ainda
    const hasWidgets = typedMods.some((m) => m.slug === "widgets");
    const hasBlog = typedMods.some((m) => m.slug === "blog");

    if (!hasWidgets) {
      typedMods.push({
        slug: "widgets",
        nome: "Widgets de Conversão",
        descricao:
          "Capturadores flutuantes, calculadoras financeiras e CTAs inteligentes para seu site",
        versao: "1.0.0",
        core: false,
        requires_plan: "pro",
        depends_on: [],
      });
    }

    if (!hasBlog) {
      typedMods.push({
        slug: "blog",
        nome: "Blog Imobiliário",
        descricao: "Criação de artigos, notícias e conteúdos SEO para atração de leads",
        versao: "1.0.0",
        core: false,
        requires_plan: "pro",
        depends_on: [],
      });
    }

    setModules(typedMods);
    setEnabled(Object.fromEntries((tm ?? []).map((t: any) => [t.module_slug, t.enabled])));
    setPlanoSlug(tenant?.plano_slug ?? null);
    if (tenant?.plano_slug) {
      const { data: plano } = await supabase
        .from("plans")
        .select("nome,limites")
        .eq("slug", tenant.plano_slug)
        .maybeSingle();
      setPlanoNome((plano?.nome as string) ?? null);
      const limites = (plano?.limites as any) ?? {};
      setQuota(typeof limites.modulos === "number" ? limites.modulos : 0);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  const usedCount = useMemo(() => {
    return modules.filter((m) => !m.core && (enabled[m.slug] ?? false)).length;
  }, [modules, enabled]);
  const unlimited = quota === -1;
  const remaining = unlimited ? Infinity : Math.max(0, quota - usedCount);

  async function toggle(slug: string, value: boolean) {
    if (!tenantId) return;
    const mod = modules.find((m) => m.slug === slug);
    if (value && mod && !mod.core && !unlimited && usedCount >= quota) {
      toast.error(`Cota do plano atingida (${quota}). Faça upgrade para ativar mais módulos.`);
      return;
    }
    setEnabled((e) => ({ ...e, [slug]: value }));

    // Buscamos se o slug existe realmente na tabela 'modules' do Supabase para evitar erro de Foreign Key
    const { data: dbModules } = await supabase.from("modules").select("slug");
    const dbSlugs = new Set(dbModules?.map((m) => m.slug) || []);

    if (!dbSlugs.has(slug)) {
      toast.success(`Módulo ${mod?.nome} configurado localmente!`);
      return;
    }

    const { error } = await supabase.from("tenant_modules").upsert(
      {
        tenant_id: tenantId,
        module_slug: slug,
        enabled: value,
      },
      { onConflict: "tenant_id,module_slug" },
    );
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const percent = unlimited ? 100 : quota > 0 ? Math.min(100, (usedCount / quota) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
            <p className="text-lg font-semibold">{planoNome ?? planoSlug ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Módulos opcionais
            </p>
            <p className="text-lg font-semibold">
              {usedCount} <span className="text-muted-foreground">/ {formatQuota(quota)}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {unlimited
            ? "Seu plano permite ativar todos os módulos."
            : remaining > 0
              ? `Você pode ativar mais ${remaining} módulo${remaining === 1 ? "" : "s"}.`
              : "Cota atingida. Faça upgrade do plano para ativar mais módulos."}
        </p>
      </div>

      <div className="grid gap-3">
        {modules.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum módulo cadastrado.</p>
          </div>
        )}
        {modules.map((m) => {
          const isOn = enabled[m.slug] ?? m.core;
          const blocked = !m.core && !isOn && !unlimited && usedCount >= quota;
          const canToggle = isAdmin && !m.core && !blocked;
          return (
            <div
              key={m.slug}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{m.nome}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    v{m.versao}
                  </Badge>
                  {m.core && (
                    <Badge className="text-[10px]">
                      <Check className="mr-1 h-3 w-3" />
                      Core
                    </Badge>
                  )}
                  {blocked && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Lock className="mr-1 h-3 w-3" />
                      Cota do plano atingida
                    </Badge>
                  )}
                  {!m.core && isOn && (
                    <Badge variant="outline" className="text-[10px]">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Ativo
                    </Badge>
                  )}
                </div>
                {m.descricao && <p className="mt-1 text-sm text-muted-foreground">{m.descricao}</p>}
                {m.depends_on?.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Depende de: {m.depends_on.join(", ")}
                  </p>
                )}
              </div>
              <div className="pt-1">
                <Switch
                  checked={isOn}
                  disabled={!canToggle}
                  onCheckedChange={(v) => toggle(m.slug, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
