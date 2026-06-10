import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/limites")({
  component: LimitesPage,
});

const LIMITS = [
  { key: "imoveis", label: "Imóveis ativos" },
  { key: "usuarios", label: "Usuários" },
  { key: "leads_mes", label: "Leads novos por mês" },
  { key: "mensagens_mes", label: "Mensagens enviadas por mês" },
  { key: "armazenamento_mb", label: "Armazenamento (MB)" },
];

type Plan = { id: string; nome: string };

function LimitesPage() {
  const { isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("plans").select("id, nome").order("nome");
      setPlans((data as Plan[]) ?? []);
      if (data?.[0]) setPlanId(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!planId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("plan_limits")
        .select("limit_key, limit_value")
        .eq("plan_id", planId);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.limit_key] = r.limit_value;
      });
      setValues(map);
    })();
  }, [planId]);

  async function salvar() {
    setSaving(true);
    const rows = LIMITS.map((l) => ({
      plan_id: planId,
      limit_key: l.key,
      limit_value: Number(values[l.key] ?? 0),
    }));
    const { error } = await (supabase as any)
      .from("plan_limits")
      .upsert(rows, { onConflict: "plan_id,limit_key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Limites salvos");
  }

  if (!isSuperAdmin)
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito.</div>;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Limites por plano</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina quotas máximas por plano. Use 0 para ilimitado.
        </p>
      </header>

      <div className="mb-4 max-w-sm">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Plano
        </label>
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3">
        {LIMITS.map((l) => (
          <div
            key={l.key}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Gauge className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.key}</div>
              </div>
            </div>
            <Input
              type="number"
              className="max-w-[160px]"
              value={values[l.key] ?? 0}
              onChange={(e) => setValues((s) => ({ ...s, [l.key]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={salvar} disabled={saving || !planId}>
        {saving ? "Salvando…" : "Salvar limites"}
      </Button>
    </div>
  );
}
