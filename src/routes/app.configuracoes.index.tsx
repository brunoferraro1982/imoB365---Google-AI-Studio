import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Package, Check, Sparkles, ShieldCheck, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatQuota } from "@/lib/format";

export const Route = createFileRoute("/app/configuracoes/")({
  component: ConfiguracoesIndex,
});

type ModuleRow = {
  slug: string;
  nome: string;
  descricao: string | null;
  core: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super-admin",
  admin: "Administrador",
  broker: "Corretor",
  atendente: "Atendente",
  juridico: "Jurídico",
  financeiro: "Financeiro",
};

function ConfiguracoesIndex() {
  const { tenantId, roles } = useAuth();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [planoNome, setPlanoNome] = useState<string | null>(null);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: mods }, { data: tm }, { data: tenant }] = await Promise.all([
        supabase.from("modules").select("slug,nome,descricao,core").order("nome"),
        supabase.from("tenant_modules").select("module_slug,enabled").eq("tenant_id", tenantId),
        supabase.from("tenants").select("plano_slug").eq("id", tenantId).maybeSingle(),
      ]);
      setModules((mods as ModuleRow[]) ?? []);
      setEnabled(Object.fromEntries((tm ?? []).map((t: any) => [t.module_slug, t.enabled])));
      if (tenant?.plano_slug) {
        const { data: plano } = await supabase
          .from("plans")
          .select("nome,limites")
          .eq("slug", tenant.plano_slug)
          .maybeSingle();
        setPlanoNome((plano?.nome as string) ?? tenant.plano_slug);
        const limites = (plano?.limites as any) ?? {};
        setQuota(typeof limites.modulos === "number" ? limites.modulos : 0);
      }
      setLoading(false);
    })();
  }, [tenantId]);

  const usedCount = useMemo(
    () => modules.filter((m) => !m.core && (enabled[m.slug] ?? false)).length,
    [modules, enabled],
  );
  const unlimited = quota === -1;
  const percent = unlimited ? 100 : quota > 0 ? Math.min(100, (usedCount / quota) * 100) : 0;

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const stats = [
    { label: "Plano atual", value: planoNome ?? "—", icon: Package },
    {
      label: "Módulos opcionais em uso",
      value: `${usedCount} / ${formatQuota(quota)}`,
      icon: Sparkles,
    },
    { label: "Papéis nesta conta", value: String(roles.length), icon: ShieldCheck },
    { label: "Uso da cota", value: `${Math.round(percent)}%`, icon: Gauge },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>Conta & plano</span>
        </div>
        <h1 className="mt-1 text-3.5xl font-black tracking-tight text-foreground">Visão geral</h1>
        <p className="mt-2 text-sm text-muted-foreground/90">
          Plano, módulos e permissões ativas para a sua conta.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <div className="pt-1 text-3xl font-black tracking-tight text-foreground">
                  {s.value}
                </div>
              </div>
              <div className="rounded-xl bg-primary/8 p-3 text-primary">
                <s.icon className="h-5 w-5 stroke-[2.25px]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Consumo de módulos do plano</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Para ativar, desativar ou trocar de plano, fale com o suporte imob365 ou acesse{" "}
              <Link to="/app/contratacao" className="text-primary underline">
                Plano & Contratação
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            {roles.map((r) => (
              <Badge key={r} variant="outline">
                {ROLE_LABEL[r] ?? r}
              </Badge>
            ))}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid gap-3">
        {modules.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum módulo cadastrado.</p>
          </div>
        )}
        {modules.map((m) => {
          const isOn = enabled[m.slug] ?? m.core;
          return (
            <div
              key={m.slug}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{m.nome}</h3>
                  {m.core && (
                    <Badge className="text-[10px]">
                      <Check className="mr-1 h-3 w-3" />
                      Core
                    </Badge>
                  )}
                </div>
                {m.descricao && <p className="mt-1 text-sm text-muted-foreground">{m.descricao}</p>}
              </div>
              <Badge variant={isOn ? "default" : "outline"} className="mt-1">
                {isOn ? (
                  <>
                    <Sparkles className="mr-1 h-3 w-3" /> Ativo
                  </>
                ) : (
                  "Inativo"
                )}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
