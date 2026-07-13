import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layers, Search, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatQuota } from "@/lib/format";

export const Route = createFileRoute("/admin/modulos")({
  component: AdminModulos,
});

type ModuleRow = {
  slug: string;
  nome: string;
  descricao: string | null;
  versao: string;
  core: boolean;
  requires_plan: string | null;
  depends_on: string[];
};

type TenantRow = { id: string; nome: string; slug: string };

function AdminModulos() {
  const [mods, setMods] = useState<ModuleRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [busca, setBusca] = useState("");
  const [tenantSel, setTenantSel] = useState<TenantRow | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [quota, setQuota] = useState(0);
  const [planoNome, setPlanoNome] = useState<string | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: tm }, { data: t }] = await Promise.all([
        supabase.from("modules").select("*").order("nome"),
        supabase.from("tenant_modules").select("module_slug,enabled"),
        supabase.from("tenants").select("id,nome,slug").order("nome"),
      ]);
      const c: Record<string, number> = {};
      (tm ?? []).forEach((r: any) => {
        if (r.enabled) c[r.module_slug] = (c[r.module_slug] ?? 0) + 1;
      });
      setMods((m as ModuleRow[]) ?? []);
      setCounts(c);
      setTenants((t as TenantRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  async function selecionarTenant(t: TenantRow) {
    setTenantSel(t);
    setLoadingTenant(true);
    const [{ data: tm }, { data: tenant }] = await Promise.all([
      supabase.from("tenant_modules").select("module_slug,enabled").eq("tenant_id", t.id),
      supabase.from("tenants").select("plano_slug").eq("id", t.id).maybeSingle(),
    ]);
    setEnabled(Object.fromEntries((tm ?? []).map((r: any) => [r.module_slug, r.enabled])));
    if (tenant?.plano_slug) {
      const { data: plano } = await supabase
        .from("plans")
        .select("nome,limites")
        .eq("slug", tenant.plano_slug)
        .maybeSingle();
      setPlanoNome((plano?.nome as string) ?? tenant.plano_slug);
      const limites = (plano?.limites as any) ?? {};
      setQuota(typeof limites.modulos === "number" ? limites.modulos : 0);
    } else {
      setPlanoNome(null);
      setQuota(0);
    }
    setLoadingTenant(false);
  }

  const usedCount = useMemo(
    () => mods.filter((m) => !m.core && (enabled[m.slug] ?? false)).length,
    [mods, enabled],
  );
  const unlimited = quota === -1;

  async function toggle(slug: string, value: boolean) {
    if (!tenantSel) return;
    const mod = mods.find((m) => m.slug === slug);
    if (value && mod && !mod.core && !unlimited && usedCount >= quota) {
      toast.error(`Cota do plano atingida (${quota}). Ajuste o plano do tenant para liberar mais.`);
      return;
    }
    setEnabled((e) => ({ ...e, [slug]: value }));
    const { error } = await supabase
      .from("tenant_modules")
      .upsert(
        { tenant_id: tenantSel.id, module_slug: slug, enabled: value },
        { onConflict: "tenant_id,module_slug" },
      );
    if (error) {
      toast.error(error.message);
      selecionarTenant(tenantSel);
      return;
    }
    setCounts((c) => ({ ...c, [slug]: (c[slug] ?? 0) + (value ? 1 : -1) }));
    toast.success(
      `${mod?.nome ?? slug} ${value ? "ativado" : "desativado"} para ${tenantSel.nome}`,
    );
  }

  const resultados = tenants.filter((t) =>
    t.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Módulos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de módulos disponíveis na plataforma e gestão por tenant. Somente super-admins
            podem ativar/desativar módulos de um tenant.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {mods.map((m) => (
          <div key={m.slug} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{m.nome}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  slug: {m.slug} · v{m.versao}
                </p>
              </div>
              {m.core ? <Badge>Core</Badge> : <Badge variant="outline">Opcional</Badge>}
            </div>
            {m.descricao && <p className="mt-2 text-sm text-muted-foreground">{m.descricao}</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Ativos em <strong className="text-foreground">{counts[m.slug] ?? 0}</strong> tenants
              </span>
              {m.depends_on?.length > 0 && <span>Depende: {m.depends_on.join(", ")}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Ativar/desativar módulos por tenant</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Busque uma imobiliária para gerenciar quais módulos ela tem acesso.
        </p>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Nome da imobiliária…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setTenantSel(null);
            }}
          />
        </div>
        {busca.trim().length >= 2 && !tenantSel && (
          <ul className="mt-2 max-w-sm rounded-lg border border-border">
            {resultados.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma imobiliária encontrada.
              </li>
            )}
            {resultados.slice(0, 8).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selecionarTenant(t)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {t.nome}
                </button>
              </li>
            ))}
          </ul>
        )}

        {tenantSel && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gerenciando</p>
                <p className="text-lg font-semibold">{tenantSel.nome}</p>
                <p className="text-xs text-muted-foreground">Plano: {planoNome ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Módulos opcionais
                </p>
                <p className="text-lg font-semibold">
                  {usedCount} <span className="text-muted-foreground">/ {formatQuota(quota)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTenantSel(null);
                  setBusca("");
                }}
                className="text-xs text-muted-foreground underline"
              >
                Trocar imobiliária
              </button>
            </div>

            {loadingTenant ? (
              <p className="text-sm text-muted-foreground">Carregando módulos…</p>
            ) : (
              <div className="grid gap-3">
                {mods.map((m) => {
                  const isOn = enabled[m.slug] ?? m.core;
                  return (
                    <div
                      key={m.slug}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.nome}</span>
                          {m.core && (
                            <Badge className="text-[10px]">
                              <Check className="mr-1 h-3 w-3" /> Core
                            </Badge>
                          )}
                          {!m.core && isOn && (
                            <Badge variant="outline" className="text-[10px]">
                              <Sparkles className="mr-1 h-3 w-3" /> Ativo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={isOn}
                        disabled={m.core}
                        onCheckedChange={(v) => toggle(m.slug, v)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
