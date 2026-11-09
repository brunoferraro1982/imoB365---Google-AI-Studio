import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { podeAgirNaEtapa } from "@/lib/permissions";
import {
  ETAPAS_CHECKLIST,
  TIPO_CHECKLIST_LABEL,
  type EtapaChecklist,
} from "@/lib/checklistContratos";
import { analisarChecklist, type ItemStatus } from "@/lib/checklistStatus";
import { aplicarModeloAoContrato } from "@/components/checklist/checklistData";
import { avancarEtapaContrato, ativarContrato } from "@/lib/contratos.functions";

type Modelo = { id: string; nome: string; padrao: boolean };
type Historico = { etapa: string; iniciada_em: string; concluida_em: string | null };

const SELECT =
  "h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function FluxoContrato({
  contratoId,
  tipoContrato,
}: {
  contratoId: string;
  tipoContrato: string;
}) {
  const { tenantId, roles } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [etapaAtual, setEtapaAtual] = useState<string>("captacao");
  const [itens, setItens] = useState<ItemStatus[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloEscolhido, setModeloEscolhido] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [avancando, setAvancando] = useState(false);
  const [bloqueio, setBloqueio] = useState<{
    etapa: string;
    pendentes: { id: string; titulo: string }[];
  } | null>(null);
  const [novo, setNovo] = useState({ titulo: "", obrigatorio: true });
  const [adicionando, setAdicionando] = useState(false);

  async function carregar() {
    if (!tenantId) return;
    const [{ data: c, error: e0 }, { data: ch, error: e1 }, { data: et }, { data: md }] =
      await Promise.all([
        supabase.from("contratos").select("etapa_atual").eq("id", contratoId).maybeSingle(),
        supabase
          .from("contrato_checklist")
          .select("id,etapa,titulo,obrigatorio,concluido,ordem")
          .eq("contrato_id", contratoId)
          .order("ordem"),
        supabase
          .from("contrato_etapas")
          .select("etapa,iniciada_em,concluida_em")
          .eq("contrato_id", contratoId)
          .order("iniciada_em", { ascending: false }),
        supabase
          .from("checklist_templates")
          .select("id,nome,padrao")
          .eq("tenant_id", tenantId)
          .eq("tipo", tipoContrato)
          .eq("ativo", true)
          .order("padrao", { ascending: false })
          .order("nome"),
      ]);
    if (e0 || e1) toast.error("Não foi possível carregar o fluxo: " + (e0 ?? e1)?.message);
    setEtapaAtual((c?.etapa_atual as string) ?? "captacao");
    setItens((ch as ItemStatus[]) ?? []);
    setHistorico((et as Historico[]) ?? []);
    const lista = (md as Modelo[]) ?? [];
    setModelos(lista);
    setModeloEscolhido((atual) => atual || lista.find((m) => m.padrao)?.id || lista[0]?.id || "");
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, tenantId, tipoContrato]);

  const analise = useMemo(() => analisarChecklist(itens, etapaAtual), [itens, etapaAtual]);
  const idxAtual = ETAPAS_CHECKLIST.findIndex((e) => e.value === etapaAtual);
  const proxima =
    idxAtual >= 0 && idxAtual < ETAPAS_CHECKLIST.length - 1 ? ETAPAS_CHECKLIST[idxAtual + 1] : null;
  const estadoAtual = analise.porEtapa[etapaAtual as EtapaChecklist];
  const podeAgir = podeAgirNaEtapa(roles ?? [], etapaAtual as never, "write");
  const padrao = modelos.find((m) => m.padrao);
  const itensEtapaAtual = itens.filter((i) => i.etapa === etapaAtual);

  async function alternar(item: ItemStatus) {
    const concluido = !item.concluido;
    const { error } = await supabase
      .from("contrato_checklist")
      .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) return toast.error("Não foi possível atualizar: " + error.message);
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, concluido } : i)));
    setBloqueio(null);
  }

  async function remover(item: ItemStatus) {
    if (!(await confirmDialog(`Remover "${item.titulo}" do checklist?`))) return;
    const { error } = await supabase.from("contrato_checklist").delete().eq("id", item.id);
    if (error) return toast.error("Não foi possível remover: " + error.message);
    setItens((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const titulo = novo.titulo.trim();
    if (!titulo || !tenantId) return;
    const ordem = itens.length + 1;
    const { data, error } = await supabase
      .from("contrato_checklist")
      .insert({
        tenant_id: tenantId,
        contrato_id: contratoId,
        etapa: etapaAtual,
        titulo,
        obrigatorio: novo.obrigatorio,
        ordem,
      })
      .select("id,etapa,titulo,obrigatorio,concluido,ordem")
      .single();
    if (error) return toast.error("Não foi possível adicionar: " + error.message);
    setItens((prev) => [...prev, data as ItemStatus]);
    setNovo({ titulo: "", obrigatorio: true });
    setAdicionando(false);
  }

  async function aplicarModelo(modeloId: string) {
    if (!tenantId || !modeloId) return;
    setAplicando(true);
    const r = await aplicarModeloAoContrato({ tenantId, contratoId, modeloId });
    setAplicando(false);
    if ("erro" in r) return toast.error(r.erro);
    toast.success(`Checklist aplicado (${r.quantidade} itens)`);
    carregar();
  }

  async function avancar() {
    if (!proxima || !tenantId) return;
    setAvancando(true);
    try {
      if (proxima.value === "ativacao") {
        await ativarContrato({ data: { tenant_id: tenantId, contrato_id: contratoId } });
        toast.success("Contrato ativado");
      } else {
        const r = await avancarEtapaContrato({
          data: { contrato_id: contratoId, para: proxima.value },
        });
        if (!r.ok) {
          setBloqueio({ etapa: r.etapa, pendentes: r.pendentes });
          toast.error("Há documentos obrigatórios pendentes nesta etapa");
          return;
        }
        toast.success(`Avançou para ${proxima.label}`);
      }
      setBloqueio(null);
      carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível avançar");
    } finally {
      setAvancando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando fluxo…</p>;
  }

  const datasEtapa = new Map<string, string>();
  for (const h of historico) {
    if (!datasEtapa.has(h.etapa)) {
      datasEtapa.set(h.etapa, h.iniciada_em);
    }
  }

  return (
    <div className="space-y-6">
      {/* Linha do tempo das etapas */}
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {ETAPAS_CHECKLIST.map((e, i) => {
          const est = analise.porEtapa[e.value];
          const concluida = i < idxAtual;
          const atual = i === idxAtual;
          return (
            <li
              key={e.value}
              className={`relative rounded-2xl border p-2.5 text-center transition ${
                atual
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : concluida
                    ? "border-emerald-300/60 bg-emerald-50/70 dark:bg-emerald-950/20"
                    : "border-white/60 bg-white/60 dark:bg-white/5"
              }`}
            >
              <div className="flex justify-center">
                {concluida ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : atual ? (
                  <Circle className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </div>
              <p className="mt-1 truncate text-[11px] font-bold">{e.label}</p>
              {est.total > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {est.feitos}/{est.total}
                </p>
              )}
              {est.semDocumentos && (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  sem docs
                </span>
              )}
              {datasEtapa.has(e.value) && concluida && (
                <p className="text-[9px] text-muted-foreground">
                  {new Date(datasEtapa.get(e.value)!).toLocaleDateString("pt-BR")}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Sem checklist */}
      {analise.semChecklist && (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-semibold">Este contrato ainda não tem checklist</p>
              {padrao ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => aplicarModelo(padrao.id)} disabled={aplicando}>
                    {aplicando ? "Aplicando…" : `Aplicar modelo padrão (${padrao.nome})`}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Não há modelo padrão para contratos de{" "}
                  {TIPO_CHECKLIST_LABEL[tipoContrato] ?? tipoContrato}.{" "}
                  <Link
                    to="/app/contratos/checklist"
                    className="font-semibold text-primary underline"
                  >
                    Definir um modelo padrão
                  </Link>
                </p>
              )}
              {modelos.length > 1 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className={SELECT}
                    value={modeloEscolhido}
                    onChange={(e) => setModeloEscolhido(e.target.value)}
                  >
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                        {m.padrao ? " (padrão)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => aplicarModelo(modeloEscolhido)}
                    disabled={!modeloEscolhido || aplicando}
                  >
                    Aplicar outro modelo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Etapa atual: documentos */}
      <section className="space-y-4 rounded-2xl border border-white/60 bg-white/60 p-5 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Etapa atual
            </p>
            <h3 className="text-lg font-bold">{estadoAtual?.label ?? etapaAtual}</h3>
          </div>
          {estadoAtual && estadoAtual.total > 0 && (
            <span className="text-sm font-semibold text-primary">
              {estadoAtual.feitos}/{estadoAtual.total} concluídos
            </span>
          )}
        </div>

        {estadoAtual?.semDocumentos && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 text-sm dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Nenhum documento cadastrado para esta etapa
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                Adicione os documentos desta etapa abaixo ou ajuste o modelo do tipo.
              </p>
            </div>
          </div>
        )}

        {itensEtapaAtual.length > 0 && (
          <ul className="space-y-1.5">
            {itensEtapaAtual.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1 dark:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => alternar(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-primary/5"
                  aria-pressed={item.concluido}
                >
                  {item.concluido ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={`min-w-0 flex-1 ${item.concluido ? "text-muted-foreground line-through" : "font-medium"}`}
                  >
                    {item.titulo}
                  </span>
                  {item.obrigatorio && !item.concluido && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      obrigatório
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remover(item)}
                  className="rounded-lg p-2 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Remover ${item.titulo}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {adicionando ? (
          <form onSubmit={adicionar} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className={SELECT}
              placeholder="Ex.: Certidão de nascimento"
              value={novo.titulo}
              onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))}
              autoFocus
            />
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={novo.obrigatorio}
                onChange={(e) => setNovo((n) => ({ ...n, obrigatorio: e.target.checked }))}
              />
              obrigatório
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!novo.titulo.trim()}>
                Adicionar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdicionando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdicionando(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar documento
          </Button>
        )}
      </section>

      {/* Avanço */}
      <section className="space-y-3">
        {bloqueio && bloqueio.etapa === etapaAtual && bloqueio.pendentes.length > 0 && (
          <div className="rounded-xl border border-red-300/70 bg-red-50/80 p-3 text-sm dark:bg-red-950/30">
            <p className="flex items-center gap-1.5 font-semibold text-red-800 dark:text-red-300">
              <Lock className="h-4 w-4" /> Não é possível avançar: {bloqueio.pendentes.length}{" "}
              documento(s) obrigatório(s) pendente(s)
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs text-red-800/90 dark:text-red-300/90">
              {bloqueio.pendentes.map((p) => (
                <li key={p.id}>{p.titulo}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {analise.pendentesTotal > 0
              ? `${analise.pendentesTotal} obrigatório(s) pendente(s) no contrato`
              : "Todos os obrigatórios do contrato estão concluídos"}
          </p>
          {proxima ? (
            <Button
              onClick={avancar}
              disabled={avancando || !podeAgir || analise.pendentesEtapaAtual.length > 0}
              title={
                !podeAgir
                  ? "Seu papel não atua nesta etapa"
                  : analise.pendentesEtapaAtual.length > 0
                    ? "Conclua os obrigatórios desta etapa"
                    : undefined
              }
            >
              {avancando ? "Avançando…" : `Avançar para ${proxima.label}`}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Última etapa do fluxo
            </span>
          )}
        </div>
      </section>

      <ConfirmDialog />
    </div>
  );
}
