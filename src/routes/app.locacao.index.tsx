import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { moduleGuard } from "@/lib/routeGuard";
import { formatBRL } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/contratosLabels";
import { Home, Landmark, Pencil, Search, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/locacao/")({
  // Mesma permissão das sub-rotas de locação (repasses e prestação de contas).
  beforeLoad: moduleGuard("financeiro"),
  component: LocacaoIndex,
});

type ContratoRow = {
  id: string;
  numero: string | null;
  valor: number | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  dia_vencimento: number | null;
  indice_reajuste: string | null;
  taxa_administracao_percentual: number | null;
  valor_iptu: number | null;
  valor_condominio: number | null;
  valor_seguro: number | null;
  imovel: { titulo: string | null } | null;
};

type LinhaLocacao = ContratoRow & {
  locadores: string;
  locatarios: string;
};

type Vinculos = {
  parcelas: number;
  repasses: number;
  lancamentos: number;
  comissoes: number;
};

type Bloqueio = Vinculos & { nome: string };

type ResumoLote = {
  total: number;
  atualizadas: number;
  erros: string[];
};

type LoteForm = {
  dia: string;
  indice: string;
  taxa: string;
  renovacao: string;
  status: string;
};

const LOTE_VAZIO: LoteForm = { dia: "", indice: "", taxa: "", renovacao: "", status: "" };

const INDICES_REAJUSTE = ["IPCA", "IGP-M", "INPC"] as const;

// Validação do lote antes de qualquer UPDATE (só campos que o usuário alterou).
const loteSchema = z
  .object({
    dia_vencimento: z
      .number()
      .int("Dia inválido")
      .min(1, "Dia deve ser entre 1 e 31")
      .max(31, "Dia deve ser entre 1 e 31")
      .optional(),
    indice_reajuste: z
      .enum(INDICES_REAJUSTE, { errorMap: () => ({ message: "Índice inválido" }) })
      .optional(),
    taxa_administracao_percentual: z
      .number({ invalid_type_error: "Taxa inválida" })
      .min(0, "Taxa não pode ser negativa")
      .max(100, "Taxa não pode passar de 100%")
      .optional(),
    renovacao_automatica: z.boolean().optional(),
    status: z.enum(["rascunho", "ativo"]).optional(),
  })
  .strict();

type LotePatch = z.infer<typeof loteSchema>;

const ROTULO_CAMPO: Record<keyof LotePatch, string> = {
  dia_vencimento: "dia de vencimento",
  indice_reajuste: "índice de reajuste",
  taxa_administracao_percentual: "taxa de administração",
  renovacao_automatica: "renovação automática",
  status: "status",
};

function fmtValorLote(campo: keyof LotePatch, valor: unknown): string {
  if (campo === "dia_vencimento") return `dia ${valor}`;
  if (campo === "taxa_administracao_percentual") return `${valor}%`;
  if (campo === "renovacao_automatica") return valor ? "sim" : "não";
  if (campo === "status") return STATUS_LABEL[String(valor)] ?? String(valor);
  return String(valor);
}

/** Data local no formato YYYY-MM-DD (comparável como string). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function diasNoMes(ano: number, mesIndex: number): number {
  return new Date(ano, mesIndex + 1, 0).getDate();
}

/**
 * Próxima data de aniversário do contrato (mesmo dia/mês de data_inicio) a partir de hoje.
 * Dia 29-31 em meses curtos cai no último dia do mês. Retorna YYYY-MM-DD ou null.
 */
function proximoAniversario(dataInicio: string | null, hoje: string): string | null {
  if (!dataInicio) return null;
  const [, m, d] = dataInicio.split("-").map(Number);
  const [anoHoje] = hoje.split("-").map(Number);
  if (!m || !d || !anoHoje) return null;
  for (const ano of [anoHoje, anoHoje + 1]) {
    const dia = Math.min(d, diasNoMes(ano, m - 1));
    const iso = `${ano}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (iso >= hoje) return iso;
  }
  return null;
}

function totalMensal(l: ContratoRow): number {
  return (l.valor ?? 0) + (l.valor_iptu ?? 0) + (l.valor_condominio ?? 0) + (l.valor_seguro ?? 0);
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function LocacaoIndex() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [linhas, setLinhas] = useState<LinhaLocacao[]>([]);
  const [osAbertas, setOsAbertas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [venc60, setVenc60] = useState(false);
  const [reajuste60, setReajuste60] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteAberto, setLoteAberto] = useState(false);
  const [loteForm, setLoteForm] = useState<LoteForm>(LOTE_VAZIO);
  const [resumoLote, setResumoLote] = useState<ResumoLote | null>(null);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [contratosRes, partesRes, osRes] = await Promise.all([
      (supabase as any)
        .from("contratos")
        .select(
          "id,numero,valor,status,data_inicio,data_fim,dia_vencimento,indice_reajuste,taxa_administracao_percentual,valor_iptu,valor_condominio,valor_seguro,imovel:imoveis(titulo)",
        )
        .eq("tenant_id", tenantId)
        .eq("tipo", "locacao")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("contrato_partes")
        .select("contrato_id,nome,papel")
        .eq("tenant_id", tenantId)
        .in("papel", ["locador", "locatario"]),
      (supabase as any)
        .from("locacao_ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .neq("status", "concluida"),
    ]);

    if (contratosRes.error) toast.error(contratosRes.error.message);

    const locadores = new Map<string, string[]>();
    const locatarios = new Map<string, string[]>();
    for (const p of (partesRes.data ?? []) as {
      contrato_id: string;
      nome: string;
      papel: string;
    }[]) {
      const alvo = p.papel === "locador" ? locadores : locatarios;
      alvo.set(p.contrato_id, [...(alvo.get(p.contrato_id) ?? []), p.nome]);
    }

    const rows = (contratosRes.data ?? []) as ContratoRow[];
    setLinhas(
      rows.map((c) => ({
        ...c,
        locadores: (locadores.get(c.id) ?? []).join(", "),
        locatarios: (locatarios.get(c.id) ?? []).join(", "),
      })),
    );
    // Mantém apenas seleções que ainda existem na listagem.
    const ids = new Set(rows.map((r) => r.id));
    setSelecionados((prev) => new Set([...prev].filter((id) => ids.has(id))));
    setOsAbertas(osRes.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  const hoje = isoLocal(new Date());
  const limite60 = isoLocal(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

  const linhasCalc = useMemo(
    () =>
      linhas.map((l) => ({
        ...l,
        proxReajuste: proximoAniversario(l.data_inicio, hoje),
      })),
    [linhas, hoje],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhasCalc.filter((l) => {
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (venc60 && !(l.data_fim && l.data_fim >= hoje && l.data_fim <= limite60)) return false;
      if (reajuste60 && !(l.proxReajuste && l.proxReajuste >= hoje && l.proxReajuste <= limite60))
        return false;
      if (termo) {
        const texto = `${l.numero ?? ""} ${l.imovel?.titulo ?? ""} ${l.locatarios}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [linhasCalc, busca, filtroStatus, venc60, reajuste60, hoje, limite60]);

  const hasFiltros = busca !== "" || filtroStatus !== "" || venc60 || reajuste60;
  const todasMarcadas = filtradas.length > 0 && filtradas.every((l) => selecionados.has(l.id));
  const qtdSelecionados = selecionados.size;

  function toggleSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todasMarcadas) filtradas.forEach((l) => next.delete(l.id));
      else filtradas.forEach((l) => next.add(l.id));
      return next;
    });
  }

  /** Conta os vínculos que impedem a exclusão. Retorna null se alguma consulta falhar. */
  async function contarVinculos(contratoId: string): Promise<Vinculos | null> {
    if (!tenantId) return null;
    const contar = (tabela: string) =>
      (supabase as any)
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("contrato_id", contratoId)
        .eq("tenant_id", tenantId);
    const [parcelas, repasses, lancamentos, comissoes] = await Promise.all([
      contar("contrato_parcelas"),
      contar("locacao_repasses"),
      contar("lancamentos_financeiros"),
      contar("comissoes"),
    ]);
    const erro = [parcelas, repasses, lancamentos, comissoes].find((r) => r.error);
    if (erro) {
      toast.error(`Não foi possível verificar os vínculos da locação: ${erro.error.message}`);
      return null;
    }
    return {
      parcelas: parcelas.count ?? 0,
      repasses: repasses.count ?? 0,
      lancamentos: lancamentos.count ?? 0,
      comissoes: comissoes.count ?? 0,
    };
  }

  async function excluirLocacao(l: LinhaLocacao) {
    if (!tenantId) return;
    const nome = l.numero ?? l.id.slice(0, 8);

    const vinculos = await contarVinculos(l.id);
    if (!vinculos) return;
    const totalVinculos =
      vinculos.parcelas + vinculos.repasses + vinculos.lancamentos + vinculos.comissoes;
    if (totalVinculos > 0) {
      setBloqueio({ nome, ...vinculos });
      return;
    }

    const imovel = l.imovel?.titulo ? ` (${l.imovel.titulo})` : "";
    const ok = await confirmDialog(
      `Excluir a locação ${nome}${imovel}? Serão apagados o contrato e as partes vinculadas (locador e locatário). Essa ação não pode ser desfeita.`,
      { title: "Excluir locação" },
    );
    if (!ok) return;

    // Ordem: primeiro as partes, depois o contrato. Cada passo é verificado.
    const { error: errPartes } = await (supabase as any)
      .from("contrato_partes")
      .delete()
      .eq("contrato_id", l.id)
      .eq("tenant_id", tenantId);
    if (errPartes) {
      toast.error(`Falha ao apagar as partes: ${errPartes.message}. A locação não foi excluída.`);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("contratos")
      .delete()
      .eq("id", l.id)
      .eq("tenant_id", tenantId)
      .select("id");
    if (error) {
      toast.error(
        `As partes foram apagadas, mas o contrato não pôde ser excluído: ${error.message}. Verifique a locação ${nome}.`,
      );
      load();
      return;
    }
    if (!data || data.length === 0) {
      toast.error(
        `A locação ${nome} não foi excluída (não encontrada ou sem permissão). As partes já foram removidas: verifique.`,
      );
      load();
      return;
    }
    toast.success(`Locação ${nome} excluída`);
    load();
  }

  function montarPatch(): LotePatch | null {
    const raw: Record<string, unknown> = {};
    if (loteForm.dia) raw.dia_vencimento = Number(loteForm.dia);
    if (loteForm.indice) raw.indice_reajuste = loteForm.indice;
    if (loteForm.taxa !== "") raw.taxa_administracao_percentual = Number(loteForm.taxa);
    if (loteForm.renovacao) raw.renovacao_automatica = loteForm.renovacao === "sim";
    if (loteForm.status) raw.status = loteForm.status;

    const parsed = loteSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Valores inválidos");
      return null;
    }
    if (Object.keys(parsed.data).length === 0) {
      toast.error("Escolha ao menos um campo para alterar");
      return null;
    }
    return parsed.data;
  }

  async function aplicarLote(patch: LotePatch) {
    if (!tenantId) return;
    const alvo = linhas.filter((l) => selecionados.has(l.id));
    const resumoCampos = (Object.keys(patch) as (keyof LotePatch)[])
      .map((k) => `${ROTULO_CAMPO[k]}: ${fmtValorLote(k, patch[k])}`)
      .join("; ");
    const ok = await confirmDialog(
      `Alterar ${plural(alvo.length, "locação", "locações")}? ${resumoCampos}.`,
      { title: "Confirmar edição em massa", confirmLabel: "Aplicar", variant: "default" },
    );
    if (!ok) return;

    let atualizadas = 0;
    const erros: string[] = [];
    const falhas: string[] = [];
    // Um UPDATE por locação, filtrado por id e tenant; cada resultado é verificado.
    for (const l of alvo) {
      const nome = l.numero ?? l.id.slice(0, 8);
      const { data, error } = await (supabase as any)
        .from("contratos")
        .update(patch)
        .eq("id", l.id)
        .eq("tenant_id", tenantId)
        .select("id");
      if (error) {
        erros.push(`${nome}: ${error.message}`);
        falhas.push(l.id);
      } else if (!data || data.length === 0) {
        erros.push(`${nome}: não atualizada (sem permissão ou não encontrada)`);
        falhas.push(l.id);
      } else {
        atualizadas++;
      }
    }

    setResumoLote({ total: alvo.length, atualizadas, erros });
    // Mantém selecionadas só as que falharam, para nova tentativa.
    setSelecionados(new Set(falhas));
    if (erros.length === 0) toast.success(`${atualizadas} locação(ões) atualizada(s)`);
    else toast.error(`${atualizadas} atualizadas, ${erros.length} com erro`);
    load();
  }

  async function prepararLote() {
    const patch = montarPatch();
    if (!patch) return;
    // Fecha o diálogo antes da confirmação para não empilhar dois modais.
    setLoteAberto(false);
    await aplicarLote(patch);
  }

  const linkEditar = { to: "/app/locacao/$id/editar" } as any;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Locação / Administração</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/app/locacao/novo">Nova locação</Link>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contratos de locação
          </p>
          <p className="mt-2 text-2xl font-bold">{linhas.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ordens de serviço abertas
          </p>
          <p className="mt-2 text-2xl font-bold">{osAbertas}</p>
          <Link
            to="/app/locacao/prestacao-contas"
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            Ver prestação de contas
          </Link>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Repasses ao proprietário
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Geração mensal, taxa de administração e status ficam em Repasses.
          </p>
          <Link to="/app/locacao/repasses">
            <Button size="sm" variant="outline" className="mt-3">
              <Landmark className="mr-1 h-4 w-4" /> Ver repasses
            </Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por imóvel, locatário ou número…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={venc60}
              onChange={(e) => setVenc60(e.target.checked)}
              className="h-4 w-4"
            />
            Vencendo em 60 dias
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reajuste60}
              onChange={(e) => setReajuste60(e.target.checked)}
              className="h-4 w-4"
            />
            Com próximo reajuste em 60 dias
          </label>
          {hasFiltros && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setBusca("");
                setFiltroStatus("");
                setVenc60(false);
                setReajuste60(false);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {qtdSelecionados > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
            <span className="font-medium">
              {plural(qtdSelecionados, "selecionada", "selecionadas")}
            </span>
            <Button
              size="sm"
              onClick={() => {
                setLoteForm(LOTE_VAZIO);
                setLoteAberto(true);
              }}
            >
              Editar em massa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
              Limpar seleção
            </Button>
          </div>
        )}

        {resumoLote && (
          <Alert>
            <AlertTitle>Edição em massa concluída</AlertTitle>
            <AlertDescription>
              <p>
                {resumoLote.atualizadas} atualizada(s), {resumoLote.erros.length} com erro (de{" "}
                {resumoLote.total}).
              </p>
              {resumoLote.erros.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {resumoLote.erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-7 px-2"
                onClick={() => setResumoLote(null)}
              >
                Fechar resumo
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando locações…</p>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8" />
            {linhas.length === 0
              ? "Nenhum contrato de locação cadastrado."
              : "Nenhuma locação encontrada com os filtros atuais."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1300px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Selecionar todas"
                      checked={todasMarcadas}
                      onChange={toggleTodas}
                    />
                  </th>
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">Imóvel</th>
                  <th className="px-3 py-2">Locador</th>
                  <th className="px-3 py-2">Locatário</th>
                  <th className="px-3 py-2 text-right">Aluguel</th>
                  <th className="px-3 py-2 text-right">Total mensal</th>
                  <th className="px-3 py-2">Venc.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Vigência</th>
                  <th className="px-3 py-2">Próx. reajuste</th>
                  <th className="px-3 py-2">Taxa adm.</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`Selecionar locação ${l.numero ?? l.id.slice(0, 8)}`}
                        checked={selecionados.has(l.id)}
                        onChange={() => toggleSelecao(l.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{l.numero ?? l.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{l.imovel?.titulo ?? "—"}</td>
                    <td className="px-3 py-2">{l.locadores || "—"}</td>
                    <td className="px-3 py-2">{l.locatarios || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(l.valor)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatBRL(totalMensal(l))}
                    </td>
                    <td className="px-3 py-2">
                      {l.dia_vencimento ? `Dia ${l.dia_vencimento}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtData(l.data_inicio)} – {fmtData(l.data_fim)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.proxReajuste
                        ? `${fmtData(l.proxReajuste)}${l.indice_reajuste ? ` · ${l.indice_reajuste}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtPct(l.taxa_administracao_percentual)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link {...linkEditar} params={{ id: l.id }}>
                          <Button size="sm" variant="outline">
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                          </Button>
                        </Link>
                        <Link to="/app/contratos/$id" params={{ id: l.id }}>
                          <Button size="sm" variant="outline">
                            Abrir contrato
                          </Button>
                        </Link>
                        <Link to="/app/locacao/repasses">
                          <Button size="sm" variant="ghost">
                            Repasses
                          </Button>
                        </Link>
                        <Link to="/app/locacao/prestacao-contas">
                          <Button size="sm" variant="ghost">
                            Prestação de contas
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => excluirLocacao(l)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={loteAberto} onOpenChange={setLoteAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar {plural(qtdSelecionados, "locação", "locações")} em massa
            </DialogTitle>
            <DialogDescription>
              Preencha só os campos que deseja alterar. Campos em &quot;Não alterar&quot; ficam como
              estão em cada locação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Dia de vencimento</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={loteForm.dia}
                onChange={(e) => setLoteForm({ ...loteForm, dia: e.target.value })}
              >
                <option value="">Não alterar</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Índice de reajuste</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={loteForm.indice}
                onChange={(e) => setLoteForm({ ...loteForm, indice: e.target.value })}
              >
                <option value="">Não alterar</option>
                {INDICES_REAJUSTE.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Taxa de administração (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="Não alterar"
                value={loteForm.taxa}
                onChange={(e) => setLoteForm({ ...loteForm, taxa: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Renovação automática</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={loteForm.renovacao}
                onChange={(e) => setLoteForm({ ...loteForm, renovacao: e.target.value })}
              >
                <option value="">Não alterar</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={loteForm.status}
                onChange={(e) => setLoteForm({ ...loteForm, status: e.target.value })}
              >
                <option value="">Não alterar</option>
                <option value="rascunho">Rascunho</option>
                <option value="ativo">Ativo</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoteAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={prepararLote}>Revisar e aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bloqueio !== null} onOpenChange={(v) => !v && setBloqueio(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir a locação</AlertDialogTitle>
            <AlertDialogDescription>
              {bloqueio && (
                <>
                  A locação {bloqueio.nome} já tem vínculos:{" "}
                  {[
                    bloqueio.parcelas > 0 && plural(bloqueio.parcelas, "parcela", "parcelas"),
                    bloqueio.repasses > 0 && plural(bloqueio.repasses, "repasse", "repasses"),
                    bloqueio.lancamentos > 0 &&
                      plural(
                        bloqueio.lancamentos,
                        "lançamento financeiro",
                        "lançamentos financeiros",
                      ),
                    bloqueio.comissoes > 0 && plural(bloqueio.comissoes, "comissão", "comissões"),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  . Para não perder o histórico financeiro, use &quot;Cancelar&quot; na locação em
                  vez de excluir.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBloqueio(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog />
    </div>
  );
}
