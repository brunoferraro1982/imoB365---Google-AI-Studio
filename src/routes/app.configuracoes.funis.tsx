import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, GitBranch } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/funis")({
  component: FunisPage,
});

type Funil = { id: string; nome: string; is_default: boolean; ativo: boolean };
type Etapa = {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  sla_horas: number | null;
  is_ganho: boolean;
  is_perdido: boolean;
};

function FunisPage() {
  const { tenantId } = useAuth();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [novoFunil, setNovoFunil] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: fs }, { data: es }] = await Promise.all([
      (supabase as any)
        .from("lead_funis")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at"),
      (supabase as any)
        .from("lead_funil_etapas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem"),
    ]);
    setFunis(fs ?? []);
    setEtapas(es ?? []);
    if (!selected && fs?.[0]) setSelected(fs[0].id);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function addFunil() {
    if (!novoFunil.trim() || !tenantId) return;
    const { error } = await (supabase as any).from("lead_funis").insert({
      tenant_id: tenantId,
      nome: novoFunil.trim(),
      is_default: funis.length === 0,
    });
    if (error) return toast.error(error.message);
    setNovoFunil("");
    load();
  }

  async function delFunil(id: string) {
    if (!confirm("Excluir o funil e suas etapas?")) return;
    await (supabase as any).from("lead_funis").delete().eq("id", id);
    if (selected === id) setSelected(null);
    load();
  }

  async function addEtapa() {
    if (!novaEtapa.trim() || !selected || !tenantId) return;
    const ordem = etapas.filter((e) => e.funil_id === selected).length;
    const { error } = await (supabase as any).from("lead_funil_etapas").insert({
      tenant_id: tenantId,
      funil_id: selected,
      nome: novaEtapa.trim(),
      ordem,
    });
    if (error) return toast.error(error.message);
    setNovaEtapa("");
    load();
  }

  async function patchEtapa(id: string, patch: Partial<Etapa>) {
    await (supabase as any).from("lead_funil_etapas").update(patch).eq("id", id);
    load();
  }

  async function delEtapa(id: string) {
    await (supabase as any).from("lead_funil_etapas").delete().eq("id", id);
    load();
  }

  const etapasDoFunil = etapas.filter((e) => e.funil_id === selected);

  return (
    <div className="max-w-5xl space-y-6 p-8">
      <header className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Funis de leads</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Crie múltiplos funis (ex.: Locação, Venda, Lançamento) com suas próprias etapas, SLA e
        cores.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[280px,1fr]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Funis</h2>
            <ul className="space-y-1">
              {funis.map((f) => (
                <li
                  key={f.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${selected === f.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <button onClick={() => setSelected(f.id)} className="flex-1 text-left">
                    {f.nome}{" "}
                    {f.is_default && (
                      <span className="ml-1 text-xs text-muted-foreground">(padrão)</span>
                    )}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => delFunil(f.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Novo funil"
                value={novoFunil}
                onChange={(e) => setNovoFunil(e.target.value)}
              />
              <Button size="sm" onClick={addFunil}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Etapas do funil</h2>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Selecione um funil.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {etapasDoFunil.map((e) => (
                    <li
                      key={e.id}
                      className="grid grid-cols-[1fr,90px,80px,80px,40px] items-center gap-2 rounded border p-2 text-sm"
                    >
                      <Input
                        defaultValue={e.nome}
                        onBlur={(ev) =>
                          ev.target.value !== e.nome && patchEtapa(e.id, { nome: ev.target.value })
                        }
                      />
                      <Input
                        type="number"
                        defaultValue={e.sla_horas ?? ""}
                        placeholder="SLA (h)"
                        onBlur={(ev) =>
                          patchEtapa(e.id, {
                            sla_horas: ev.target.value ? Number(ev.target.value) : null,
                          })
                        }
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={e.is_ganho}
                          onChange={(ev) => patchEtapa(e.id, { is_ganho: ev.target.checked })}
                        />{" "}
                        Ganho
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={e.is_perdido}
                          onChange={(ev) => patchEtapa(e.id, { is_perdido: ev.target.checked })}
                        />{" "}
                        Perdido
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => delEtapa(e.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Nova etapa"
                    value={novaEtapa}
                    onChange={(e) => setNovaEtapa(e.target.value)}
                  />
                  <Button size="sm" onClick={addEtapa}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
