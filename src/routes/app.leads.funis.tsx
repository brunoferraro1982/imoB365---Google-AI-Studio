import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, GitBranch, Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/leads/funis")({
  component: FunisPage,
});

const CATEGORIAS = [
  { value: "novo", label: "Novo" },
  { value: "contato", label: "Em contato" },
  { value: "visita", label: "Visita" },
  { value: "proposta", label: "Proposta" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
] as const;

type Funil = { id: string; nome: string; is_default: boolean; ativo: boolean };
type Etapa = {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  sla_horas: number | null;
  categoria: string;
};

function FunisPage() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [novoFunil, setNovoFunil] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [usos, setUsos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: fs }, { data: es }, { data: ls }] = await Promise.all([
      (supabase as any)
        .from("lead_funis")
        .select("id,nome,is_default,ativo")
        .eq("tenant_id", tenantId)
        .order("created_at"),
      (supabase as any)
        .from("lead_funil_etapas")
        .select("id,funil_id,nome,ordem,cor,sla_horas,categoria")
        .eq("tenant_id", tenantId)
        .order("ordem"),
      (supabase as any).from("leads").select("funil_id,etapa_id").eq("tenant_id", tenantId),
    ]);
    const contagem: Record<string, number> = {};
    for (const l of (ls as any[]) ?? []) {
      if (l.etapa_id) contagem[l.etapa_id] = (contagem[l.etapa_id] ?? 0) + 1;
      if (l.funil_id) contagem[`f:${l.funil_id}`] = (contagem[`f:${l.funil_id}`] ?? 0) + 1;
    }
    setUsos(contagem);
    setFunis(fs ?? []);
    setEtapas(es ?? []);
    setSelected((atual) => atual ?? fs?.[0]?.id ?? null);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const etapasDoFunil = useMemo(
    () => etapas.filter((e) => e.funil_id === selected),
    [etapas, selected],
  );
  const categoriasUsadas = new Set(etapasDoFunil.map((e) => e.categoria));
  const faltando = ["ganho", "perdido"].filter((c) => !categoriasUsadas.has(c));

  async function addFunil() {
    if (!novoFunil.trim() || !tenantId) return;
    const { data, error } = await (supabase as any)
      .from("lead_funis")
      .insert({ tenant_id: tenantId, nome: novoFunil.trim(), is_default: funis.length === 0 })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNovoFunil("");
    setSelected(data.id);
    load();
  }

  async function definirPadrao(id: string) {
    if (!tenantId) return;
    // um só padrão: limpa o atual e marca o escolhido
    await (supabase as any)
      .from("lead_funis")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);
    const { error } = await (supabase as any)
      .from("lead_funis")
      .update({ is_default: true })
      .eq("id", id);
    if (error) toast.error(error.message);
    load();
  }

  async function delFunil(f: Funil) {
    if ((usos[`f:${f.id}`] ?? 0) > 0) {
      return toast.error("Este funil tem leads. Mova os leads para outro funil antes de excluir.");
    }
    if (!(await confirmDialog(`Excluir o funil "${f.nome}" e suas etapas?`))) return;
    const { error } = await (supabase as any).from("lead_funis").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    if (selected === f.id) setSelected(null);
    load();
  }

  async function addEtapa() {
    if (!novaEtapa.trim() || !selected || !tenantId) return;
    const { error } = await (supabase as any).from("lead_funil_etapas").insert({
      tenant_id: tenantId,
      funil_id: selected,
      nome: novaEtapa.trim(),
      ordem: etapasDoFunil.length + 1,
      categoria: "contato",
    });
    if (error) return toast.error(error.message);
    setNovaEtapa("");
    load();
  }

  async function patchEtapa(id: string, patch: Partial<Etapa>) {
    const { error } = await (supabase as any).from("lead_funil_etapas").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    load();
  }

  async function moverEtapa(id: string, direcao: -1 | 1) {
    const idx = etapasDoFunil.findIndex((e) => e.id === id);
    const alvo = etapasDoFunil[idx + direcao];
    if (idx < 0 || !alvo) return;
    const atual = etapasDoFunil[idx];
    await (supabase as any)
      .from("lead_funil_etapas")
      .update({ ordem: alvo.ordem })
      .eq("id", atual.id);
    await (supabase as any)
      .from("lead_funil_etapas")
      .update({ ordem: atual.ordem })
      .eq("id", alvo.id);
    load();
  }

  async function delEtapa(e: Etapa) {
    if ((usos[e.id] ?? 0) > 0) {
      return toast.error(
        `Esta etapa tem ${usos[e.id]} lead(s). Mova-os para outra etapa antes de excluir.`,
      );
    }
    if (!(await confirmDialog(`Excluir a etapa "${e.nome}"?`))) return;
    const { error } = await (supabase as any).from("lead_funil_etapas").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    load();
  }

  const funilSel = funis.find((f) => f.id === selected);

  return (
    <div className="max-w-5xl space-y-6 p-8">
      <ConfirmDialog />
      <Link
        to="/app/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Leads
      </Link>
      <header className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Funis de leads</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Cada etapa tem uma categoria. Ao mover um lead no kanban, a etapa e o status acompanham a
        categoria. O funil padrão é o que recebe os leads novos.
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
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${selected === f.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <button onClick={() => setSelected(f.id)} className="flex-1 text-left">
                    {f.nome}
                    {f.is_default && (
                      <span className="ml-1 text-xs text-muted-foreground">(padrão)</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {usos[`f:${f.id}`] ?? 0} lead(s)
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => delFunil(f)}
                    aria-label="Excluir funil"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
              {funis.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum funil ainda.</li>
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Novo funil"
                value={novoFunil}
                onChange={(e) => setNovoFunil(e.target.value)}
              />
              <Button size="sm" onClick={addFunil} aria-label="Criar funil">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {funilSel && !funilSel.is_default && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => definirPadrao(funilSel.id)}
              >
                Definir como padrão
              </Button>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Etapas{funilSel ? ` de ${funilSel.nome}` : ""}
            </h2>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Crie ou selecione um funil.</p>
            ) : (
              <>
                {faltando.length > 0 && (
                  <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                    Falta uma etapa da categoria{" "}
                    {faltando.map((c) => CATEGORIAS.find((x) => x.value === c)?.label).join(" e ")}.
                    Leads ganhos e perdidos precisam dela.
                  </p>
                )}
                <ul className="space-y-2">
                  {etapasDoFunil.map((e, i) => (
                    <li
                      key={e.id}
                      className="grid grid-cols-[28px,1fr,140px,80px,auto] items-center gap-2 rounded border p-2 text-sm"
                    >
                      <span className="flex flex-col">
                        <button
                          disabled={i === 0}
                          onClick={() => moverEtapa(e.id, -1)}
                          aria-label="Subir"
                          className="disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={i === etapasDoFunil.length - 1}
                          onClick={() => moverEtapa(e.id, 1)}
                          aria-label="Descer"
                          className="disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </span>
                      <Input
                        defaultValue={e.nome}
                        onBlur={(ev) =>
                          ev.target.value !== e.nome && patchEtapa(e.id, { nome: ev.target.value })
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={e.categoria}
                        onChange={(ev) => patchEtapa(e.id, { categoria: ev.target.value })}
                        aria-label="Categoria"
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => delEtapa(e)}
                        aria-label="Excluir etapa"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <span className="col-span-5 text-xs text-muted-foreground">
                        {usos[e.id] ?? 0} lead(s) nesta etapa
                      </span>
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
                    <Plus className="mr-1 h-4 w-4" /> Adicionar etapa
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
