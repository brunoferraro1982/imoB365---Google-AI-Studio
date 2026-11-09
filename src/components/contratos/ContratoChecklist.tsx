import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Circle, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { ETAPAS_CHECKLIST, TIPO_CHECKLIST_LABEL, agruparPorEtapa } from "@/lib/checklistContratos";

type Item = {
  id: string;
  etapa: string;
  titulo: string;
  obrigatorio: boolean;
  ordem: number;
  concluido: boolean;
  concluido_em: string | null;
};

type Modelo = { id: string; nome: string; tipo: string };

type Props = {
  contratoId: string;
  tenantId: string;
  /** Tipo do contrato: modelos desse tipo aparecem primeiro. */
  tipoContrato?: string;
};

const SELECT =
  "h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function ContratoChecklist({ contratoId, tenantId, tipoContrato }: Props) {
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [itens, setItens] = useState<Item[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState({ titulo: "", etapa: "documentacao", obrigatorio: true });
  const [adicionando, setAdicionando] = useState(false);

  async function carregar() {
    const [{ data: ch, error: e1 }, { data: md, error: e2 }] = await Promise.all([
      supabase
        .from("contrato_checklist")
        .select("id,etapa,titulo,obrigatorio,ordem,concluido,concluido_em")
        .eq("contrato_id", contratoId)
        .order("ordem"),
      supabase
        .from("checklist_templates")
        .select("id,nome,tipo")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome"),
    ]);
    if (e1 || e2) toast.error("Não foi possível carregar o checklist: " + (e1 ?? e2)?.message);
    setItens((ch as Item[]) ?? []);
    const lista = (md as Modelo[]) ?? [];
    // modelos do mesmo tipo do contrato primeiro
    lista.sort((a, b) => Number(b.tipo === tipoContrato) - Number(a.tipo === tipoContrato));
    setModelos(lista);
    setModeloId((atual) => atual || lista.find((m) => m.tipo === tipoContrato)?.id || "");
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, tenantId]);

  const total = itens.length;
  const feitos = itens.filter((i) => i.concluido).length;
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
  const pendObrig = itens.filter((i) => i.obrigatorio && !i.concluido).length;
  const grupos = useMemo(() => agruparPorEtapa(itens), [itens]);

  async function aplicarModelo() {
    if (!modeloId) return;
    setAplicando(true);
    const { data: modeloItens, error: e1 } = await supabase
      .from("checklist_template_itens")
      .select("etapa,titulo,obrigatorio,ordem")
      .eq("template_id", modeloId)
      .order("ordem");
    if (e1) {
      setAplicando(false);
      return toast.error("Não foi possível ler o modelo: " + e1.message);
    }
    if (!modeloItens?.length) {
      setAplicando(false);
      return toast.error("Este modelo ainda não tem itens.");
    }
    const { error: e2 } = await supabase.from("contrato_checklist").insert(
      modeloItens.map((i) => ({
        tenant_id: tenantId,
        contrato_id: contratoId,
        etapa: i.etapa,
        titulo: i.titulo,
        obrigatorio: i.obrigatorio,
        ordem: i.ordem,
      })),
    );
    setAplicando(false);
    if (e2) return toast.error("Não foi possível aplicar o modelo: " + e2.message);
    toast.success(`Checklist aplicado (${modeloItens.length} itens)`);
    carregar();
  }

  async function alternar(item: Item) {
    const concluido = !item.concluido;
    const { error } = await supabase
      .from("contrato_checklist")
      .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) return toast.error("Não foi possível atualizar o item: " + error.message);
    setItens((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, concluido, concluido_em: concluido ? new Date().toISOString() : null }
          : i,
      ),
    );
  }

  async function remover(item: Item) {
    if (!(await confirmDialog(`Remover "${item.titulo}" do checklist?`))) return;
    const { error } = await supabase.from("contrato_checklist").delete().eq("id", item.id);
    if (error) return toast.error("Não foi possível remover: " + error.message);
    setItens((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const titulo = novo.titulo.trim();
    if (!titulo) return;
    const ordem = itens.length + 1;
    const { data, error } = await supabase
      .from("contrato_checklist")
      .insert({
        tenant_id: tenantId,
        contrato_id: contratoId,
        etapa: novo.etapa,
        titulo,
        obrigatorio: novo.obrigatorio,
        ordem,
      })
      .select("id,etapa,titulo,obrigatorio,ordem,concluido,concluido_em")
      .single();
    if (error) return toast.error("Não foi possível adicionar: " + error.message);
    setItens((prev) => [...prev, data as Item]);
    setNovo((n) => ({ ...n, titulo: "" }));
    setAdicionando(false);
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando checklist…</p>;
  }

  // Estado vazio: convida a aplicar um modelo ou criar um item.
  if (total === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 font-semibold">Este contrato ainda não tem checklist</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aplique um modelo pronto para o tipo do contrato ou adicione os documentos um a um.
          </p>
        </div>
        {modelos.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className={SELECT}
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
            >
              <option value="">Escolha um modelo…</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} · {TIPO_CHECKLIST_LABEL[m.tipo] ?? m.tipo}
                </option>
              ))}
            </select>
            <Button onClick={aplicarModelo} disabled={!modeloId || aplicando}>
              {aplicando ? "Aplicando…" : "Aplicar modelo"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum modelo ativo.{" "}
            <Link
              to="/app/contratos/checklist/novo"
              className="font-semibold text-primary underline"
            >
              Criar um modelo de checklist
            </Link>
          </p>
        )}
        <AdicionarItem
          novo={novo}
          setNovo={setNovo}
          aberto={adicionando}
          setAberto={setAdicionando}
          onSubmit={adicionar}
        />
        <ConfirmDialog />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progresso */}
      <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {feitos} de {total} concluídos
          </span>
          <span className="font-bold text-primary">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct === 100 ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pendObrig > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {pendObrig} item{pendObrig > 1 ? "s" : ""} obrigatório{pendObrig > 1 ? "s" : ""}{" "}
            pendente
            {pendObrig > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            Todos os itens obrigatórios estão concluídos.
          </p>
        )}
      </div>

      {/* Etapas, na ordem do workflow */}
      {grupos.map((g) => {
        const feitosGrupo = g.itens.filter((i) => i.concluido).length;
        return (
          <section key={g.etapa} className="space-y-2">
            <header className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {feitosGrupo}/{g.itens.length}
              </span>
            </header>
            <ul className="space-y-1.5">
              {g.itens.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center gap-2 rounded-xl border border-white/50 bg-white/60 px-2 py-1 dark:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => alternar(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-primary/5"
                    aria-pressed={item.concluido}
                  >
                    {item.concluido ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={`min-w-0 flex-1 ${
                        item.concluido ? "text-muted-foreground line-through" : "font-medium"
                      }`}
                    >
                      {item.titulo}
                    </span>
                    {item.obrigatorio && !item.concluido && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        obrigatório
                      </span>
                    )}
                    {item.concluido && item.concluido_em && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(item.concluido_em).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(item)}
                    className="rounded-lg p-2 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Remover ${item.titulo}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <AdicionarItem
        novo={novo}
        setNovo={setNovo}
        aberto={adicionando}
        setAberto={setAdicionando}
        onSubmit={adicionar}
      />
      <ConfirmDialog />
    </div>
  );
}

function AdicionarItem({
  novo,
  setNovo,
  aberto,
  setAberto,
  onSubmit,
}: {
  novo: { titulo: string; etapa: string; obrigatorio: boolean };
  setNovo: (fn: (n: typeof novo) => typeof novo) => void;
  aberto: boolean;
  setAberto: (v: boolean) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar item
      </Button>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-2 rounded-2xl border border-border bg-background/60 p-3 sm:grid-cols-[1fr_180px_auto]"
    >
      <input
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        placeholder="Ex.: Certidão de nascimento"
        value={novo.titulo}
        onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))}
        autoFocus
      />
      <select
        className={SELECT}
        value={novo.etapa}
        onChange={(e) => setNovo((n) => ({ ...n, etapa: e.target.value }))}
      >
        {ETAPAS_CHECKLIST.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={novo.obrigatorio}
            onChange={(e) => setNovo((n) => ({ ...n, obrigatorio: e.target.checked }))}
          />
          obrigatório
        </label>
        <Button type="submit" size="sm" disabled={!novo.titulo.trim()}>
          Adicionar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
