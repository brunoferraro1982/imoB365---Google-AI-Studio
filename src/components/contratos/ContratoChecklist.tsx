import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type ChecklistItem = {
  id: string;
  etapa: string;
  titulo: string;
  obrigatorio: boolean;
  ordem: number;
  concluido: boolean;
  concluido_em: string | null;
};

type ChecklistTemplate = {
  id: string;
  nome: string;
};

type Props = {
  contratoId: string;
  tenantId: string;
};

export function ContratoChecklist({ contratoId, tenantId }: Props) {
  const [itens, setItens] = useState<ChecklistItem[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [tplId, setTplId] = useState("");
  const [applying, setApplying] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("documentos");
  const [addingItem, setAddingItem] = useState(false);

  async function load() {
    const [{ data: checkData }, { data: tplData }] = await Promise.all([
      supabase
        .from("contrato_checklist")
        .select("id,etapa,titulo,obrigatorio,ordem,concluido,concluido_em")
        .eq("contrato_id", contratoId)
        .order("etapa")
        .order("ordem"),
      supabase
        .from("checklist_templates")
        .select("id,nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true),
    ]);
    setItens((checkData as ChecklistItem[]) ?? []);
    setTemplates((tplData as ChecklistTemplate[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [contratoId, tenantId]);

  async function aplicarTemplate() {
    if (!tplId) return;
    setApplying(true);
    const { data: tplItens } = await supabase
      .from("checklist_template_itens")
      .select("etapa,titulo,obrigatorio,ordem")
      .eq("template_id", tplId)
      .order("ordem");
    if (!tplItens?.length) {
      setApplying(false);
      return toast.error("Modelo sem itens");
    }
    const rows = (tplItens as Array<{
      etapa: string; titulo: string; obrigatorio: boolean; ordem: number;
    }>).map((i) => ({
      tenant_id: tenantId,
      contrato_id: contratoId,
      etapa: i.etapa,
      titulo: i.titulo,
      obrigatorio: i.obrigatorio,
      ordem: i.ordem,
    }));
    const { error } = await supabase.from("contrato_checklist").insert(rows);
    setApplying(false);
    if (error) return toast.error(error.message);
    toast.success("Checklist aplicado");
    setTplId("");
    load();
  }

  async function toggle(item: ChecklistItem) {
    await supabase
      .from("contrato_checklist")
      .update({
        concluido: !item.concluido,
        concluido_em: !item.concluido ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
    setItens((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, concluido: !i.concluido, concluido_em: !i.concluido ? new Date().toISOString() : null }
          : i,
      ),
    );
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("contrato_checklist")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    const ordem = itens.filter((i) => i.etapa === novaEtapa).length + 1;
    const { data, error } = await supabase
      .from("contrato_checklist")
      .insert({
        tenant_id: tenantId,
        contrato_id: contratoId,
        etapa: novaEtapa,
        titulo: novoTitulo.trim(),
        obrigatorio: false,
        ordem,
      })
      .select("id,etapa,titulo,obrigatorio,ordem,concluido,concluido_em")
      .single();
    if (error) return toast.error(error.message);
    setItens((prev) => [...prev, data as ChecklistItem]);
    setNovoTitulo("");
    setAddingItem(false);
  }

  // Stats
  const total = itens.length;
  const done = itens.filter((i) => i.concluido).length;
  const pendObrig = itens.filter((i) => i.obrigatorio && !i.concluido).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Unique etapas for add form
  const etapas = [...new Set(itens.map((i) => i.etapa))];
  if (!etapas.includes("documentos")) etapas.unshift("documentos");

  const grupos = itens.reduce<Record<string, ChecklistItem[]>>((acc, it) => {
    (acc[it.etapa] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Apply template (only when empty) */}
      {itens.length === 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
            >
              <option value="">Escolha um modelo de checklist…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={aplicarTemplate} disabled={!tplId || applying}>
              {applying ? "Aplicando…" : "Aplicar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ou adicione itens manualmente abaixo.
          </p>
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done}/{total} concluído{done !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct === 100 ? "bg-emerald-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pendObrig > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              {pendObrig} item{pendObrig > 1 ? "s" : ""} obrigatório{pendObrig > 1 ? "s" : ""} pendente{pendObrig > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Groups */}
      {Object.entries(grupos).map(([etapa, lista]) => (
        <div key={etapa}>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {etapa}
            <span className="rounded bg-muted px-1.5 py-0.5 font-normal normal-case">
              {lista.filter((i) => i.concluido).length}/{lista.length}
            </span>
          </h4>
          <ul className="space-y-1">
            {lista.map((item) => (
              <li key={item.id} className="group flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="flex flex-1 items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-left text-sm hover:border-border hover:bg-muted transition-colors"
                >
                  {item.concluido ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={`flex-1 ${
                      item.concluido ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.titulo}
                  </span>
                  {item.obrigatorio && !item.concluido && (
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      obrig.
                    </span>
                  )}
                  {item.concluido && item.concluido_em && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(item.concluido_em).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  aria-label="Remover item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Inline add form */}
      {addingItem ? (
        <form onSubmit={addItem} className="flex gap-2 border-t border-border pt-3">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
          >
            {etapas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
            <option value="__new__">+ nova etapa…</option>
          </select>
          {novaEtapa === "__new__" ? (
            <Input
              className="h-9 flex-1 text-sm"
              placeholder="Nome da etapa"
              value={novaEtapa === "__new__" ? "" : novaEtapa}
              onChange={(e) => setNovaEtapa(e.target.value)}
              autoFocus
            />
          ) : null}
          <Input
            className="h-9 flex-1 text-sm"
            placeholder="Título do documento ou tarefa…"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            autoFocus={novaEtapa !== "__new__"}
            maxLength={200}
          />
          <Button type="submit" size="sm" disabled={!novoTitulo.trim()}>
            Adicionar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAddingItem(false);
              setNovoTitulo("");
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingItem(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item manualmente
        </button>
      )}
    </div>
  );
}
