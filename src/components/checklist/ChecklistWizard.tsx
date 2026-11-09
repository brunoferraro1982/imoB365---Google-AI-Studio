import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SELO, TITULO_SECAO } from "@/components/portal/PaginaGlass";
import {
  ETAPAS_CHECKLIST,
  ETAPA_LABEL,
  TIPOS_CHECKLIST,
  TIPO_CHECKLIST_LABEL,
  agruparPorEtapa,
  sugestoesDoTipo,
  type EtapaChecklist,
} from "@/lib/checklistContratos";
import {
  aplicarModeloAoContrato,
  criarModeloComItens,
  definirModeloPadrao,
  type ItemModelo,
} from "@/components/checklist/checklistData";
import { analisarChecklist } from "@/lib/checklistStatus";
import { SUGESTOES_POR_TIPO } from "@/lib/checklistContratos";

const PASSOS = ["Tipo", "Modelo", "Contrato", "Revisar"] as const;

const GLASS = "glass-fosco rounded-3xl border border-white/40 p-6 md:p-8";
const INPUT =
  "h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

type ModeloExistente = { id: string; nome: string; tipo: string; qtd: number; padrao: boolean };
type ContratoOpcao = { id: string; numero: string | null; status: string; valor: number };

/**
 * Wizard "Novo checklist": tipo → modelo → contrato (opcional) → revisão.
 * Cada tipo de contrato parte da sua sugestão de documentos, editável.
 */
export function ChecklistWizard() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [passo, setPasso] = useState(0);
  const [tipo, setTipo] = useState<string>("");
  const [modo, setModo] = useState<"existente" | "novo">("novo");
  const [modelos, setModelos] = useState<ModeloExistente[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [itens, setItens] = useState<ItemModelo[]>([]);
  const [contratos, setContratos] = useState<ContratoOpcao[]>([]);
  const [contratoId, setContratoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [definirPadrao, setDefinirPadrao] = useState(false);
  const [concluido, setConcluido] = useState<{
    modeloId: string;
    contratoId?: string;
    qtd?: number;
  } | null>(null);

  // Ao escolher o tipo: modelos desse tipo e sugestão inicial.
  useEffect(() => {
    if (!tipo || !tenantId) return;
    (async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id,nome,tipo,padrao")
        .eq("tenant_id", tenantId)
        .eq("tipo", tipo)
        .eq("ativo", true)
        .order("nome");
      if (error) return toast.error("Não foi possível carregar os modelos: " + error.message);
      const ids = (data ?? []).map((m) => m.id);
      const { data: cont } = ids.length
        ? await supabase
            .from("checklist_template_itens")
            .select("template_id")
            .in("template_id", ids)
        : { data: [] as { template_id: string }[] };
      const cont2 = (cont ?? []) as { template_id: string }[];
      const lista = (data ?? []).map((m) => ({
        ...m,
        qtd: cont2.filter((c) => c.template_id === m.id).length,
      }));
      setModelos(lista);
      setDefinirPadrao(!lista.some((m) => m.padrao));
      setModo(lista.length > 0 ? "existente" : "novo");
      setModeloId(lista[0]?.id ?? "");
      setNomeNovo(`Checklist — ${TIPO_CHECKLIST_LABEL[tipo] ?? tipo}`);
      setItens(sugestoesDoTipo(tipo).map((s, i) => ({ ...s, ordem: i + 1 })));
    })();
  }, [tipo, tenantId]);

  // Passo 3: contratos do tipo escolhido que ainda não têm checklist.
  useEffect(() => {
    if (passo !== 2 || !tipo || !tenantId) return;
    (async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id,numero,status,valor")
        .eq("tenant_id", tenantId)
        .eq("tipo", tipo as never)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return toast.error("Não foi possível carregar os contratos: " + error.message);
      const ids = (data ?? []).map((c) => c.id);
      const { data: com } = ids.length
        ? await supabase.from("contrato_checklist").select("contrato_id").in("contrato_id", ids)
        : { data: [] as { contrato_id: string }[] };
      const comChecklist = new Set((com ?? []).map((c) => c.contrato_id));
      setContratos(
        (data ?? [])
          .filter((c) => !comChecklist.has(c.id))
          .map((c) => ({ id: c.id, numero: c.numero, status: c.status, valor: Number(c.valor) })),
      );
    })();
  }, [passo, tipo, tenantId]);

  const itensValidos = itens.filter((i) => i.titulo.trim());
  const podeAvancar =
    passo === 0
      ? !!tipo
      : passo === 1
        ? modo === "existente"
          ? !!modeloId
          : !!nomeNovo.trim() && itensValidos.length > 0
        : passo === 2
          ? true
          : false;

  function atualizarItem(idx: number, patch: Partial<ItemModelo>) {
    setItens((prev) => prev.map((i, n) => (n === idx ? { ...i, ...patch } : i)));
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, n) => n !== idx));
  }

  function adicionarItem(etapa: EtapaChecklist) {
    setItens((prev) => [...prev, { etapa, titulo: "", obrigatorio: true, ordem: prev.length + 1 }]);
  }

  async function concluir() {
    if (!tenantId) return;
    setSalvando(true);
    let modeloFinal = modeloId;
    if (modo === "novo") {
      const r = await criarModeloComItens({
        tenantId,
        nome: nomeNovo.trim(),
        tipo,
        itens: itensValidos.map((i, idx) => ({ ...i, titulo: i.titulo.trim(), ordem: idx + 1 })),
      });
      if ("erro" in r) {
        setSalvando(false);
        return toast.error(r.erro);
      }
      modeloFinal = r.id;
    }
    if (definirPadrao) {
      const r = await definirModeloPadrao(modeloFinal);
      if ("erro" in r) toast.warning("Modelo salvo, mas não foi definido como padrão: " + r.erro);
    }
    let qtd: number | undefined;
    if (contratoId) {
      const r = await aplicarModeloAoContrato({ tenantId, contratoId, modeloId: modeloFinal });
      if ("erro" in r) {
        setSalvando(false);
        toast.error(r.erro);
        return;
      }
      qtd = r.quantidade;
    }
    setSalvando(false);
    setConcluido({ modeloId: modeloFinal, contratoId: contratoId || undefined, qtd });
    toast.success(contratoId ? "Checklist aplicado ao contrato" : "Modelo salvo");
  }

  if (concluido) {
    return (
      <div className={`${GLASS} mx-auto max-w-2xl text-center`}>
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 className={`${TITULO_SECAO} mt-4`}>
          {concluido.contratoId ? "Checklist aplicado" : "Modelo salvo"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {concluido.contratoId
            ? `${concluido.qtd} itens foram adicionados ao contrato.`
            : "O modelo já pode ser aplicado a contratos desse tipo."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {concluido.contratoId && (
            <Button
              onClick={() =>
                navigate({ to: "/app/contratos/$id", params: { id: concluido.contratoId! } })
              }
            >
              Abrir contrato
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate({ to: "/app/contratos/checklist" })}>
            Gerenciar modelos
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConcluido(null);
              setPasso(0);
              setTipo("");
            }}
          >
            Novo checklist
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/app/contratos/checklist"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Checklists
        </Link>
      </div>

      {/* Indicador de passos */}
      <ol className="grid grid-cols-4 gap-2">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            className={`rounded-2xl px-3 py-2.5 text-center text-xs font-semibold transition ${
              i === passo
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                : i < passo
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-white/60 text-muted-foreground dark:bg-white/5"
            }`}
          >
            <span className="mr-1 opacity-80">{i + 1}.</span>
            {p}
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <section className={GLASS}>
          <span className={SELO}>Passo 1</span>
          <h2 className={`${TITULO_SECAO} mt-3`}>Qual o tipo de contrato?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada tipo tem seus documentos típicos. Você pode ajustá-los no próximo passo.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TIPOS_CHECKLIST.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  tipo === t.value
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-white/60 bg-white/70 dark:bg-white/5"
                }`}
              >
                <p className="font-bold">{t.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.descricao}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {passo === 1 && (
        <section className={`${GLASS} space-y-6`}>
          <div>
            <span className={SELO}>Passo 2</span>
            <h2 className={`${TITULO_SECAO} mt-3`}>Modelo de checklist</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use um modelo que já existe para {TIPO_CHECKLIST_LABEL[tipo]} ou monte um novo.
            </p>
          </div>

          {modelos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Modelos existentes
              </p>
              {modelos.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                    modo === "existente" && modeloId === m.id
                      ? "border-primary bg-primary/10"
                      : "border-white/60 bg-white/70 dark:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="modelo"
                      checked={modo === "existente" && modeloId === m.id}
                      onChange={() => {
                        setModo("existente");
                        setModeloId(m.id);
                      }}
                    />
                    <span className="font-semibold">{m.nome}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{m.qtd} itens</span>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="radio"
                name="modelo"
                checked={modo === "novo"}
                onChange={() => setModo("novo")}
              />
              Criar um novo modelo a partir da sugestão para {TIPO_CHECKLIST_LABEL[tipo]}
            </label>

            {modo === "novo" && (
              <div className="space-y-4 rounded-2xl bg-white/60 p-4 dark:bg-white/5">
                <input
                  className={INPUT}
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                  placeholder="Nome do modelo"
                />
                <ItensEditor
                  itens={itens}
                  onChange={atualizarItem}
                  onRemove={removerItem}
                  onAdd={adicionarItem}
                />
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-2xl bg-white/60 p-4 dark:bg-white/5">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={definirPadrao}
                onChange={(e) => setDefinirPadrao(e.target.checked)}
              />
              Usar como padrão para contratos de {TIPO_CHECKLIST_LABEL[tipo]}
            </label>
            <p className="text-xs text-muted-foreground">
              Contratos desse tipo recebem o modelo padrão automaticamente ao serem criados.
              {modelos.some((m) => m.padrao) && " O padrão atual deixa de valer."}
            </p>
            {modo === "novo" && !SUGESTOES_POR_TIPO[tipo] && (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Ainda não há sugestão específica para este tipo: revise os documentos antes de
                salvar.
              </p>
            )}
          </div>
        </section>
      )}

      {passo === 2 && (
        <section className={`${GLASS} space-y-5`}>
          <div>
            <span className={SELO}>Passo 3 · opcional</span>
            <h2 className={`${TITULO_SECAO} mt-3`}>Aplicar a um contrato agora?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mostramos contratos de {TIPO_CHECKLIST_LABEL[tipo]} que ainda não têm checklist.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm font-semibold dark:bg-white/5">
            <input
              type="radio"
              name="contrato"
              checked={!contratoId}
              onChange={() => setContratoId("")}
            />
            Não aplicar agora (só salvar o modelo)
          </label>
          {contratos.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum contrato de {TIPO_CHECKLIST_LABEL[tipo]} sem checklist.
            </p>
          )}
          {contratos.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                contratoId === c.id
                  ? "border-primary bg-primary/10"
                  : "border-white/60 bg-white/70 dark:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="contrato"
                  checked={contratoId === c.id}
                  onChange={() => setContratoId(c.id)}
                />
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold">Contrato {c.numero ?? c.id.slice(0, 8)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {c.status} ·{" "}
                {c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </label>
          ))}
        </section>
      )}

      {passo === 3 && (
        <section className={`${GLASS} space-y-5`}>
          <div>
            <span className={SELO}>Passo 4</span>
            <h2 className={`${TITULO_SECAO} mt-3`}>Revisar e concluir</h2>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
              <dt className="text-xs text-muted-foreground">Tipo</dt>
              <dd className="font-semibold">{TIPO_CHECKLIST_LABEL[tipo]}</dd>
            </div>
            <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
              <dt className="text-xs text-muted-foreground">Modelo</dt>
              <dd className="font-semibold">
                {modo === "novo"
                  ? `${nomeNovo} (novo)`
                  : modelos.find((m) => m.id === modeloId)?.nome}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
              <dt className="text-xs text-muted-foreground">Padrão do tipo</dt>
              <dd className="font-semibold">
                {definirPadrao ? "Sim, aplicar automaticamente" : "Não"}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Contrato</dt>
              <dd className="font-semibold">
                {contratoId
                  ? `Contrato ${contratos.find((c) => c.id === contratoId)?.numero ?? contratoId.slice(0, 8)}`
                  : "Não aplicar agora"}
              </dd>
            </div>
          </dl>
          {modo === "novo" && <ResumoEtapas itens={itensValidos} />}
        </section>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          disabled={passo === 0 || salvando}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {passo < 3 ? (
          <Button onClick={() => setPasso((p) => p + 1)} disabled={!podeAvancar}>
            Continuar <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={concluir} disabled={salvando}>
            {salvando ? "Salvando…" : contratoId ? "Salvar e aplicar" : "Salvar modelo"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ItensEditor({
  itens,
  onChange,
  onRemove,
  onAdd,
}: {
  itens: ItemModelo[];
  onChange: (idx: number, patch: Partial<ItemModelo>) => void;
  onRemove: (idx: number) => void;
  onAdd: (etapa: EtapaChecklist) => void;
}) {
  // Mantém o índice original de cada item ao agrupar por etapa.
  const indexados = itens.map((item, idx) => ({ item, idx }));
  return (
    <div className="space-y-5">
      {ETAPAS_CHECKLIST.map((e) => {
        const lista = indexados.filter((x) => x.item.etapa === e.value);
        if (lista.length === 0) return null;
        return (
          <div key={e.value} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {e.label}
            </p>
            {lista.map(({ item, idx }) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className={INPUT}
                  value={item.titulo}
                  placeholder="Descreva o documento"
                  onChange={(ev) => onChange(idx, { titulo: ev.target.value })}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={item.obrigatorio}
                    onChange={(ev) => onChange(idx, { obrigatorio: ev.target.checked })}
                  />
                  obrigatório
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <AdicionarEtapa onAdd={onAdd} />
    </div>
  );
}

function AdicionarEtapa({ onAdd }: { onAdd: (etapa: EtapaChecklist) => void }) {
  const [etapa, setEtapa] = useState<EtapaChecklist>("documentacao");
  return (
    <div className="flex items-center gap-2 border-t border-border/60 pt-4">
      <select
        className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm"
        value={etapa}
        onChange={(e) => setEtapa(e.target.value as EtapaChecklist)}
      >
        {ETAPAS_CHECKLIST.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(etapa)}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar documento
      </Button>
    </div>
  );
}

function ResumoEtapas({ itens }: { itens: ItemModelo[] }) {
  const grupos = useMemo(() => agruparPorEtapa(itens), [itens]);
  const semDocs = analisarChecklist(
    itens.map((i) => ({ ...i, id: "", concluido: false })),
    "",
  ).etapasSemDocumento;
  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum documento no modelo.</p>;
  }
  return (
    <div className="space-y-3">
      {semDocs.length > 0 && (
        <p className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Sem documentos nas etapas: {semDocs.map((e) => ETAPA_LABEL[e]).join(", ")}. Contratos que
          passarem por elas serão sinalizados.
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {grupos.map((g) => (
          <li key={g.etapa} className="rounded-2xl bg-white/70 p-4 text-sm dark:bg-white/5">
            <p className="font-bold">{ETAPA_LABEL[g.etapa] ?? g.label}</p>
            <p className="text-xs text-muted-foreground">
              {g.itens.length} documento{g.itens.length > 1 ? "s" : ""} ·{" "}
              {g.itens.filter((i) => i.obrigatorio).length} obrigatório(s)
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
