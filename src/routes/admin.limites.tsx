import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/limites")({
  component: LimitesPage,
});

const LIMITS = [
  { key: "imoveis", label: "Imóveis ativos", enforced: true },
  { key: "usuarios", label: "Usuários", enforced: true },
  { key: "modulos", label: "Módulos opcionais", enforced: true },
  { key: "leads_mes", label: "Leads novos por mês", enforced: false },
  { key: "mensagens_mes", label: "Mensagens enviadas por mês", enforced: false },
  { key: "armazenamento_mb", label: "Armazenamento (MB)", enforced: false },
];

type Plan = { id: string; nome: string; limites: Record<string, number> };

function LimitesPage() {
  const { isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("plans").select("id,nome,limites").order("nome");
      const rows = (data as unknown as Plan[]) ?? [];
      setPlans(rows);
      if (rows[0]) {
        setPlanId(rows[0].id);
        setValues(rows[0].limites ?? {});
      }
    })();
  }, []);

  function selectPlan(id: string) {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    setValues(p?.limites ?? {});
  }

  async function salvar() {
    setSaving(true);
    const limites = Object.fromEntries(LIMITS.map((l) => [l.key, Number(values[l.key] ?? 0)]));
    const { error } = await supabase.from("plans").update({ limites }).eq("id", planId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Limites salvos");
    setPlans((ps) => ps.map((p) => (p.id === planId ? { ...p, limites } : p)));
  }

  if (!isSuperAdmin)
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito.</div>;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Limites por plano</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define as cotas máximas por plano, gravadas direto em <code>plans.limites</code> — a mesma
          fonte já usada em Equipe, Contratação e na Visão Geral do tenant. Use <strong>-1</strong>{" "}
          para ilimitado.
        </p>
      </header>

      <div className="mb-4 max-w-sm">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Plano
        </label>
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={planId}
          onChange={(e) => selectPlan(e.target.value)}
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
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.label}
                  {!l.enforced && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      ainda não aplicado automaticamente
                    </Badge>
                  )}
                </div>
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
