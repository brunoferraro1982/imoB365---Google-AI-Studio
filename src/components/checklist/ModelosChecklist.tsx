import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { SELO, TITULO_SECAO } from "@/components/portal/PaginaGlass";
import {
  ETAPAS_CHECKLIST,
  TIPO_CHECKLIST_LABEL,
  agruparPorEtapa,
  type EtapaChecklist,
} from "@/lib/checklistContratos";

type Modelo = { id: string; nome: string; tipo: string; ativo: boolean };
type ItemDb = {
  id: string;
  template_id: string;
  etapa: string;
  titulo: string;
  obrigatorio: boolean;
  ordem: number;
};

const INPUT =
  "h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Gestão dos modelos de checklist (Jurídico → Checklists). */
export function ModelosChecklist() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [itens, setItens] = useState<ItemDb[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    if (!tenantId) return;
    const [{ data: md, error: e1 }, { data: it, error: e2 }] = await Promise.all([
      supabase
        .from("checklist_templates")
        .select("id,nome,tipo,ativo")
        .eq("tenant_id", tenantId)
        .order("nome"),
      supabase
        .from("checklist_template_itens")
        .select("id,template_id,etapa,titulo,obrigatorio,ordem")
        .eq("tenant_id", tenantId)
        .order("ordem"),
    ]);
    if (e1 || e2) toast.error("Não foi possível carregar os checklists: " + (e1 ?? e2)?.message);
    const lista = (md as Modelo[]) ?? [];
    setModelos(lista);
    setItens((it as ItemDb[]) ?? []);
    setSelId((atual) =>
      atual && lista.some((m) => m.id === atual) ? atual : (lista[0]?.id ?? ""),
    );
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const modelo = modelos.find((m) => m.id === selId);
  const itensDoModelo = useMemo(
    () => itens.filter((i) => i.template_id === selId).sort((a, b) => a.ordem - b.ordem),
    [itens, selId],
  );
  const grupos = useMemo(() => agruparPorEtapa(itensDoModelo), [itensDoModelo]);

  const porTipo = useMemo(() => {
    const map = new Map<string, Modelo[]>();
    for (const m of modelos) map.set(m.tipo, [...(map.get(m.tipo) ?? []), m]);
    return [...map.entries()];
  }, [modelos]);

  async function salvarModelo(patch: Partial<Pick<Modelo, "nome" | "ativo">>) {
    if (!modelo) return;
    const { error } = await supabase.from("checklist_templates").update(patch).eq("id", modelo.id);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    setModelos((prev) => prev.map((m) => (m.id === modelo.id ? { ...m, ...patch } : m)));
  }

  async function excluirModelo() {
    if (!modelo) return;
    if (
      !(await confirmDialog(
        `Excluir o modelo "${modelo.nome}" e seus itens? Os checklists já aplicados em contratos não são alterados.`,
      ))
    )
      return;
    const { error } = await supabase.from("checklist_templates").delete().eq("id", modelo.id);
    if (error) return toast.error("Não foi possível excluir: " + error.message);
    toast.success("Modelo excluído");
    carregar();
  }

  async function salvarItem(item: ItemDb, patch: Partial<ItemDb>) {
    const { error } = await supabase
      .from("checklist_template_itens")
      .update(patch)
      .eq("id", item.id);
    if (error) {
      toast.error("Não foi possível salvar o item: " + error.message);
      return false;
    }
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    return true;
  }

  async function removerItem(item: ItemDb) {
    if (!(await confirmDialog(`Remover "${item.titulo}" do modelo?`))) return;
    const { error } = await supabase.from("checklist_template_itens").delete().eq("id", item.id);
    if (error) return toast.error("Não foi possível remover: " + error.message);
    setItens((prev) => prev.filter((i) => i.id !== item.id));
  }

  // Reordena trocando o campo ordem com o vizinho dentro do mesmo modelo.
  async function mover(item: ItemDb, direcao: -1 | 1) {
    const idx = itensDoModelo.findIndex((i) => i.id === item.id);
    const vizinho = itensDoModelo[idx + direcao];
    if (!vizinho) return;
    const ok1 = await salvarItem(item, { ordem: vizinho.ordem });
    if (!ok1) return;
    const ok2 = await salvarItem(vizinho, { ordem: item.ordem });
    if (!ok2) return carregar();
  }

  async function adicionarItem(etapa: EtapaChecklist, titulo: string, obrigatorio: boolean) {
    if (!modelo || !tenantId) return false;
    const ordem = itensDoModelo.length + 1;
    const { data, error } = await supabase
      .from("checklist_template_itens")
      .insert({ tenant_id: tenantId, template_id: modelo.id, etapa, titulo, obrigatorio, ordem })
      .select("id,template_id,etapa,titulo,obrigatorio,ordem")
      .single();
    if (error) {
      toast.error("Não foi possível adicionar: " + error.message);
      return false;
    }
    setItens((prev) => [...prev, data as ItemDb]);
    return true;
  }

  return (
    <div className="space-y-6">
      <section className="glass-fosco rounded-3xl border border-white/40 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className={SELO}>Jurídico</span>
            <h1 className={`${TITULO_SECAO} mt-3`}>Checklists de documentos</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Modelos com os documentos de cada tipo de contrato. Ao criar um contrato ou aplicar um
              modelo, os itens entram no checklist do contrato.
            </p>
          </div>
          <Link to="/app/contratos/checklist/novo">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" /> Novo checklist
            </Button>
          </Link>
        </div>
      </section>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : modelos.length === 0 ? (
        <div className="glass-fosco rounded-3xl border border-dashed border-border p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-semibold">Nenhum modelo ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o primeiro checklist em poucos passos, a partir da sugestão do tipo de contrato.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Lista de modelos por tipo */}
          <aside className="space-y-5">
            {porTipo.map(([tipo, lista]) => (
              <div key={tipo} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {TIPO_CHECKLIST_LABEL[tipo] ?? tipo}
                </p>
                {lista.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelId(m.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selId === m.id
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-white/60 bg-white/70 hover:-translate-y-0.5 dark:bg-white/5"
                    }`}
                  >
                    <p className="flex items-center justify-between gap-2 font-semibold">
                      <span className="truncate">{m.nome}</span>
                      {!m.ativo && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          inativo
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {itens.filter((i) => i.template_id === m.id).length} itens
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Editor do modelo selecionado */}
          {modelo && (
            <section className="glass-fosco space-y-6 rounded-3xl border border-white/40 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    Tipo: {TIPO_CHECKLIST_LABEL[modelo.tipo] ?? modelo.tipo}
                  </p>
                  <NomeModelo
                    key={modelo.id}
                    nome={modelo.nome}
                    onSave={(nome) => salvarModelo({ nome })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold dark:bg-white/5">
                    <input
                      type="checkbox"
                      checked={modelo.ativo}
                      onChange={(e) => salvarModelo({ ativo: e.target.checked })}
                    />
                    ativo para novos contratos
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={excluirModelo}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir
                  </Button>
                </div>
              </div>

              {grupos.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Este modelo ainda não tem documentos. Adicione abaixo.
                </p>
              )}

              {grupos.map((g) => (
                <div key={g.etapa} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </p>
                  {g.itens.map((item, i) => (
                    <ItemLinha
                      key={item.id}
                      item={item}
                      primeiro={itensDoModelo[0]?.id === item.id}
                      ultimo={itensDoModelo[itensDoModelo.length - 1]?.id === item.id}
                      onSave={(patch) => salvarItem(item, patch)}
                      onMove={(d) => mover(item, d)}
                      onRemove={() => removerItem(item)}
                    />
                  ))}
                </div>
              ))}

              <NovoItem onAdd={adicionarItem} />
            </section>
          )}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

function NomeModelo({ nome, onSave }: { nome: string; onSave: (nome: string) => void }) {
  const [valor, setValor] = useState(nome);
  return (
    <input
      className="mt-1 w-full bg-transparent text-xl font-bold tracking-tight focus:outline-none"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        const limpo = valor.trim();
        if (!limpo) return setValor(nome);
        if (limpo !== nome) onSave(limpo);
      }}
      aria-label="Nome do modelo"
    />
  );
}

function ItemLinha({
  item,
  primeiro,
  ultimo,
  onSave,
  onMove,
  onRemove,
}: {
  item: ItemDb;
  primeiro: boolean;
  ultimo: boolean;
  onSave: (patch: Partial<ItemDb>) => Promise<boolean>;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [titulo, setTitulo] = useState(item.titulo);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/60 px-2 py-1 dark:bg-white/5">
      <input
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={async () => {
          const limpo = titulo.trim();
          if (!limpo) return setTitulo(item.titulo);
          if (limpo !== item.titulo) {
            const ok = await onSave({ titulo: limpo });
            if (!ok) setTitulo(item.titulo);
          }
        }}
        aria-label="Documento"
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={item.obrigatorio}
          onChange={(e) => onSave({ obrigatorio: e.target.checked })}
        />
        obrigatório
      </label>
      <button
        type="button"
        disabled={primeiro}
        onClick={() => onMove(-1)}
        className="rounded p-1.5 hover:bg-muted disabled:opacity-30"
        aria-label="Subir"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={ultimo}
        onClick={() => onMove(1)}
        className="rounded p-1.5 hover:bg-muted disabled:opacity-30"
        aria-label="Descer"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NovoItem({
  onAdd,
}: {
  onAdd: (etapa: EtapaChecklist, titulo: string, obrigatorio: boolean) => Promise<boolean>;
}) {
  const [etapa, setEtapa] = useState<EtapaChecklist>("documentacao");
  const [titulo, setTitulo] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  return (
    <form
      className="grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-[180px_1fr_auto_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        const limpo = titulo.trim();
        if (!limpo) return;
        const ok = await onAdd(etapa, limpo, obrigatorio);
        if (ok) setTitulo("");
      }}
    >
      <select
        className={INPUT}
        value={etapa}
        onChange={(e) => setEtapa(e.target.value as EtapaChecklist)}
      >
        {ETAPAS_CHECKLIST.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <input
        className={INPUT}
        placeholder="Novo documento"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={obrigatorio}
          onChange={(e) => setObrigatorio(e.target.checked)}
        />
        obrigatório
      </label>
      <Button type="submit" size="sm" disabled={!titulo.trim()}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar
      </Button>
    </form>
  );
}
