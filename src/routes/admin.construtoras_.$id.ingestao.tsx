import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import {
  ChevronLeft,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ImageOff,
  FileText,
  Video,
  Search,
  Building2,
  User,
} from "lucide-react";
import {
  aprovarLote,
  rejeitarLote,
  obterThumbnailsFrescos,
} from "@/lib/construtoraIngestao.functions";

export const Route = createFileRoute("/admin/construtoras_/$id/ingestao")({
  component: IngestaoRevisaoPage,
});

type TipoAlvo = "empreendimento" | "imovel";

type Fonte = { id: string; nome: string; tipo_alvo: TipoAlvo };

type Lote = {
  id: string;
  fonte_id: string;
  nome_bruto: string;
  link_origem: string;
  status: string;
  dados_extraidos: { unidades?: UnidadeEditavel[] } | null;
  erro_mensagem: string | null;
  empreendimento_id: string | null;
  imovel_id: string | null;
};

type Midia = {
  id: string;
  tipo: string;
  thumbnail_url: string | null;
  score_ia: number | null;
  legenda_ia: string | null;
  recomendada: boolean;
};

type UnidadeEditavel = {
  bloco: string | null;
  andar: number | null;
  numero: string;
  tipo_planta: string | null;
  area: number | null;
  preco: number | null;
};

// tenantId + corretorId=null → destino é a imobiliária como um todo;
// corretorId preenchido → destino é aquele corretor específico (dentro
// do tenant dele) — só faz sentido pra revendas (tipo_alvo=imovel),
// empreendimentos não têm campo de corretor responsável.
type Destino = { tenantId: string; corretorId: string | null; label: string };

type Aprovacao = { tenantId: string; corretorId: string | null; label: string };

type EstadoLote = {
  nome: string;
  destinos: Destino[];
  buscaDestino: string;
  resultadosBuscaDestino: Destino[];
  aprovacoesExistentes: Aprovacao[] | null;
  unidades: (UnidadeEditavel & { key: string })[];
  imovelPreco: number | null;
  imovelArea: number | null;
  imovelQuartos: number | null;
  imovelDescricao: string;
  midias: Midia[] | null; // null = ainda não carregado
  midiasSelecionadas: Set<string>;
  salvando: boolean;
};

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  novo: { label: "Novo", variant: "outline" },
  coletando: { label: "Coletando", variant: "outline" },
  pronto_revisao: { label: "Pendente de revisão", variant: "default" },
  aprovado: { label: "Aprovado", variant: "secondary" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  erro: { label: "Erro", variant: "destructive" },
};

function novaUnidade(): UnidadeEditavel & { key: string } {
  return {
    key: crypto.randomUUID(),
    bloco: null,
    andar: null,
    numero: "",
    tipo_planta: null,
    area: null,
    preco: null,
  };
}

function chaveDestino(d: { tenantId: string; corretorId: string | null }) {
  return `${d.tenantId}:${d.corretorId ?? ""}`;
}

function IngestaoRevisaoPage() {
  const { id } = Route.useParams();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const fnAprovar = useServerFn(aprovarLote);
  const fnRejeitar = useServerFn(rejeitarLote);
  const fnThumbnails = useServerFn(obterThumbnailsFrescos);

  const [nomeConstrutora, setNomeConstrutora] = useState("");
  const [fontes, setFontes] = useState<Map<string, Fonte>>(new Map());
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"pendentes" | "todos">("pendentes");
  const [estados, setEstados] = useState<Record<string, EstadoLote>>({});

  async function load() {
    setLoading(true);
    const [{ data: construtora }, { data: fontesData }] = await Promise.all([
      supabase.from("construtoras").select("nome").eq("id", id).maybeSingle(),
      supabase
        .from("construtora_fontes_ingestao")
        .select("id,nome,tipo_alvo")
        .eq("construtora_id", id),
    ]);
    setNomeConstrutora((construtora as { nome: string } | null)?.nome ?? "");
    const mapaFontes = new Map<string, Fonte>();
    for (const f of (fontesData ?? []) as Fonte[]) mapaFontes.set(f.id, f);
    setFontes(mapaFontes);

    const fonteIds = Array.from(mapaFontes.keys());
    if (fonteIds.length === 0) {
      setLotes([]);
      setLoading(false);
      return;
    }
    const { data: lotesData } = await supabase
      .from("construtora_ingestao_lotes")
      .select(
        "id,fonte_id,nome_bruto,link_origem,status,dados_extraidos,erro_mensagem,empreendimento_id,imovel_id",
      )
      .in("fonte_id", fonteIds)
      .order("created_at", { ascending: false });
    setLotes((lotesData ?? []) as Lote[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function abrirLote(lote: Lote) {
    if (estados[lote.id]) return; // já inicializado
    const unidadesBase = (lote.dados_extraidos?.unidades ?? []).map((u) => ({
      ...u,
      key: crypto.randomUUID(),
    }));
    const primeira = unidadesBase[0];
    setEstados((prev) => ({
      ...prev,
      [lote.id]: {
        nome: lote.nome_bruto,
        destinos: [],
        buscaDestino: "",
        resultadosBuscaDestino: [],
        aprovacoesExistentes: null,
        unidades: unidadesBase,
        imovelPreco: primeira?.preco ?? null,
        imovelArea: primeira?.area ?? null,
        imovelQuartos: null,
        imovelDescricao: "",
        midias: null,
        midiasSelecionadas: new Set(),
        salvando: false,
      },
    }));

    if (lote.status === "aprovado") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: aprovacoesData } = await (supabase as any)
        .from("construtora_ingestao_aprovacoes")
        .select("tenant_id,corretor_id")
        .eq("lote_id", lote.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linhas = (aprovacoesData ?? []) as any[];
      const tenantIds = [...new Set(linhas.map((a) => a.tenant_id))];
      const corretorIds = linhas.map((a) => a.corretor_id).filter(Boolean);
      const [{ data: tenantsData }, { data: corretoresData }] = await Promise.all([
        tenantIds.length > 0
          ? supabase.from("tenants").select("id,nome").in("id", tenantIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        corretorIds.length > 0
          ? supabase.from("corretores").select("id,nome").in("id", corretorIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      ]);
      const nomeTenant = new Map((tenantsData ?? []).map((t) => [t.id, t.nome]));
      const nomeCorretor = new Map((corretoresData ?? []).map((c) => [c.id, c.nome]));
      const aprovacoes: Aprovacao[] = linhas.map((a) => ({
        tenantId: a.tenant_id,
        corretorId: a.corretor_id,
        label: a.corretor_id
          ? `${nomeCorretor.get(a.corretor_id) ?? "Corretor"} — ${nomeTenant.get(a.tenant_id) ?? "?"}`
          : (nomeTenant.get(a.tenant_id) ?? "?"),
      }));
      setEstados((prev) => ({
        ...prev,
        [lote.id]: { ...prev[lote.id], aprovacoesExistentes: aprovacoes },
      }));
    }

    const { data: midiasData } = await supabase
      .from("construtora_ingestao_midias")
      .select("id,tipo,thumbnail_url,score_ia,legenda_ia,recomendada")
      .eq("lote_id", lote.id)
      .neq("tipo", "pdf_tabela")
      .order("score_ia", { ascending: false, nullsFirst: false });
    let midias = (midiasData ?? []) as Midia[];
    const selecionadasIniciais = new Set(midias.filter((m) => m.recomendada).map((m) => m.id));
    setEstados((prev) => ({
      ...prev,
      [lote.id]: { ...prev[lote.id], midias, midiasSelecionadas: selecionadasIniciais },
    }));

    // O thumbnail_url salvo no banco é uma URL assinada da Drive API que
    // expira bem antes da revisão acontecer (achado real — ver
    // construtoraIngestao.functions.ts) — busca um link fresco pra cada
    // mídia antes de exibir, em vez de confiar no valor gravado.
    try {
      const frescos = await fnThumbnails({ data: { midiaIds: midias.map((m) => m.id) } });
      const porId = new Map(frescos.map((f) => [f.id, f.thumbnailUrl]));
      midias = midias.map((m) => ({ ...m, thumbnail_url: porId.get(m.id) ?? null }));
      setEstados((prev) => ({ ...prev, [lote.id]: { ...prev[lote.id], midias } }));
    } catch {
      // Se a busca de thumbnails frescos falhar (ex.: Drive API fora do ar),
      // mantém os dados já carregados — mídias ficam sem preview, mas o
      // resto da revisão (unidades, seleção por id) continua funcionando.
    }
  }

  function patchEstado(loteId: string, patch: Partial<EstadoLote>) {
    setEstados((prev) => ({ ...prev, [loteId]: { ...prev[loteId], ...patch } }));
  }

  async function buscarDestinos(lote: Lote, termo: string) {
    patchEstado(lote.id, { buscaDestino: termo });
    if (termo.trim().length < 2) {
      patchEstado(lote.id, { resultadosBuscaDestino: [] });
      return;
    }
    const fonte = fontes.get(lote.fonte_id);
    const [{ data: tenantsData }, corretoresRes] = await Promise.all([
      supabase.from("tenants").select("id,nome").ilike("nome", `%${termo}%`).limit(8),
      fonte?.tipo_alvo === "imovel"
        ? supabase
            .from("corretores")
            .select("id,nome,tenant_id")
            .ilike("nome", `%${termo}%`)
            .eq("ativo", true)
            .limit(8)
        : Promise.resolve({ data: [] as { id: string; nome: string; tenant_id: string }[] }),
    ]);
    const corretoresData = corretoresRes.data ?? [];

    const nomePorTenant = new Map((tenantsData ?? []).map((t) => [t.id, t.nome]));
    const tenantIdsFaltando = [...new Set(corretoresData.map((c) => c.tenant_id))].filter(
      (tid) => !nomePorTenant.has(tid),
    );
    if (tenantIdsFaltando.length > 0) {
      const { data: extras } = await supabase
        .from("tenants")
        .select("id,nome")
        .in("id", tenantIdsFaltando);
      for (const t of extras ?? []) nomePorTenant.set(t.id, t.nome);
    }

    const resultados: Destino[] = [
      ...(tenantsData ?? []).map((t) => ({
        tenantId: t.id,
        corretorId: null,
        label: t.nome,
      })),
      ...corretoresData.map((c) => ({
        tenantId: c.tenant_id,
        corretorId: c.id,
        label: `${c.nome} — ${nomePorTenant.get(c.tenant_id) ?? "?"}`,
      })),
    ];
    patchEstado(lote.id, { resultadosBuscaDestino: resultados });
  }

  function adicionarDestino(loteId: string, destino: Destino) {
    setEstados((prev) => {
      const atual = prev[loteId];
      if (atual.destinos.some((d) => chaveDestino(d) === chaveDestino(destino))) return prev;
      return {
        ...prev,
        [loteId]: {
          ...atual,
          destinos: [...atual.destinos, destino],
          buscaDestino: "",
          resultadosBuscaDestino: [],
        },
      };
    });
  }

  function removerDestino(loteId: string, destino: Destino) {
    setEstados((prev) => ({
      ...prev,
      [loteId]: {
        ...prev[loteId],
        destinos: prev[loteId].destinos.filter((d) => chaveDestino(d) !== chaveDestino(destino)),
      },
    }));
  }

  function toggleMidia(loteId: string, midiaId: string) {
    setEstados((prev) => {
      const atual = prev[loteId];
      const nova = new Set(atual.midiasSelecionadas);
      if (nova.has(midiaId)) nova.delete(midiaId);
      else nova.add(midiaId);
      return { ...prev, [loteId]: { ...atual, midiasSelecionadas: nova } };
    });
  }

  function addUnidade(loteId: string) {
    setEstados((prev) => ({
      ...prev,
      [loteId]: { ...prev[loteId], unidades: [...prev[loteId].unidades, novaUnidade()] },
    }));
  }

  function removerUnidade(loteId: string, key: string) {
    setEstados((prev) => ({
      ...prev,
      [loteId]: {
        ...prev[loteId],
        unidades: prev[loteId].unidades.filter((u) => u.key !== key),
      },
    }));
  }

  function patchUnidade(loteId: string, key: string, patch: Partial<UnidadeEditavel>) {
    setEstados((prev) => ({
      ...prev,
      [loteId]: {
        ...prev[loteId],
        unidades: prev[loteId].unidades.map((u) => (u.key === key ? { ...u, ...patch } : u)),
      },
    }));
  }

  async function aprovar(lote: Lote) {
    const estado = estados[lote.id];
    const fonte = fontes.get(lote.fonte_id);
    if (!estado || !fonte) return;
    if (estado.destinos.length === 0) {
      toast.error("Selecione ao menos uma imobiliária ou corretor.");
      return;
    }
    patchEstado(lote.id, { salvando: true });
    try {
      const resultado = await fnAprovar({
        data: {
          loteId: lote.id,
          destinos: estado.destinos.map((d) => ({
            tenantId: d.tenantId,
            corretorId: d.corretorId,
          })),
          midiaIds: Array.from(estado.midiasSelecionadas),
          nome: estado.nome.trim() || lote.nome_bruto,
          unidades:
            fonte.tipo_alvo === "empreendimento"
              ? estado.unidades.filter((u) => u.numero.trim()).map(({ key: _key, ...u }) => u)
              : undefined,
          imovel:
            fonte.tipo_alvo === "imovel"
              ? {
                  preco: estado.imovelPreco,
                  area_total: estado.imovelArea,
                  quartos: estado.imovelQuartos,
                  descricao: estado.imovelDescricao.trim() || null,
                }
              : undefined,
        },
      });
      const sucesso = resultado.resultados.filter((r) => !r.erro).length;
      const falhas = resultado.resultados.filter((r) => r.erro);
      if (sucesso > 0) {
        toast.success(
          `${sucesso} rascunho(s) criado(s) — publicado=false, revise em ${fonte.tipo_alvo === "empreendimento" ? "/app/empreendimentos" : "/app/imoveis"}.`,
        );
      }
      for (const f of falhas) {
        toast.error(`Falhou pra um destino: ${f.erro}`);
      }
      await load();
      setEstados((prev) => {
        const { [lote.id]: _removido, ...resto } = prev;
        return resto;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar lote");
    } finally {
      patchEstado(lote.id, { salvando: false });
    }
  }

  async function rejeitar(lote: Lote) {
    if (!(await confirmDialog(`Rejeitar o lote "${lote.nome_bruto}"?`, { title: "Rejeitar lote" })))
      return;
    patchEstado(lote.id, { salvando: true });
    try {
      await fnRejeitar({ data: { loteId: lote.id } });
      toast.success("Lote rejeitado.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao rejeitar lote");
    }
  }

  const lotesFiltrados =
    filtro === "pendentes" ? lotes.filter((l) => l.status === "pronto_revisao") : lotes;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <ConfirmDialog />
      <div>
        <Link
          to="/admin/construtoras"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Construtoras
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Revisão de ingestão — {nomeConstrutora || "..."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lotes descobertos automaticamente (Linktree/Drive/PDF). Nada aqui publica sozinho —
          aprovar só cria um rascunho por imobiliária/corretor selecionado (
          <code>publicado=false</code>), revisável no fluxo normal de empreendimentos/imóveis.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filtro === "pendentes" ? "default" : "outline"}
          onClick={() => setFiltro("pendentes")}
        >
          Pendentes ({lotes.filter((l) => l.status === "pronto_revisao").length})
        </Button>
        <Button
          size="sm"
          variant={filtro === "todos" ? "default" : "outline"}
          onClick={() => setFiltro("todos")}
        >
          Todos ({lotes.length})
        </Button>
      </div>

      {lotesFiltrados.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhum lote {filtro === "pendentes" ? "pendente de revisão" : "encontrado"} — rode
          "Sincronizar agora" na tela da construtora primeiro.
        </div>
      )}

      <Accordion type="multiple" className="rounded-xl border border-border bg-card px-4">
        {lotesFiltrados.map((lote) => {
          const fonte = fontes.get(lote.fonte_id);
          const st = STATUS_LABEL[lote.status] ?? {
            label: lote.status,
            variant: "outline" as const,
          };
          const estado = estados[lote.id];
          const podeRevisar = lote.status === "pronto_revisao" || lote.status === "aprovado";

          return (
            <AccordionItem key={lote.id} value={lote.id}>
              <AccordionTrigger onClick={() => abrirLote(lote)}>
                <div className="flex flex-1 flex-wrap items-center gap-2 pr-2 text-left">
                  <span className="font-medium">{lote.nome_bruto}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {fonte?.tipo_alvo === "imovel" ? "Revenda" : "Lançamento"}
                  </Badge>
                  <Badge variant={st.variant} className="text-[10px]">
                    {st.label}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!estado && <div className="text-xs text-muted-foreground">Carregando...</div>}
                {estado && (
                  <div className="space-y-4">
                    <a
                      href={lote.link_origem}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-fit items-center gap-1 text-xs text-primary underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver origem
                    </a>

                    {lote.erro_mensagem && (
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {lote.erro_mensagem}
                      </p>
                    )}

                    {lote.status === "aprovado" && (
                      <div className="rounded-md bg-secondary/50 px-3 py-2 text-xs">
                        <p className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovado, publicado=false.
                          {estado.destinos.length === 0 && " Pode atribuir a mais destinos abaixo."}
                        </p>
                        {estado.aprovacoesExistentes === null && (
                          <p className="mt-1 text-muted-foreground">Carregando destinos...</p>
                        )}
                        {estado.aprovacoesExistentes && estado.aprovacoesExistentes.length > 0 && (
                          <ul className="mt-1 list-inside list-disc text-muted-foreground">
                            {estado.aprovacoesExistentes.map((a) => (
                              <li key={chaveDestino(a)}>{a.label}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {lote.status === "rejeitado" && (
                      <p className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs">
                        <XCircle className="h-3.5 w-3.5" /> Rejeitado.
                      </p>
                    )}

                    {podeRevisar && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                              Nome
                            </Label>
                            <Input
                              value={estado.nome}
                              onChange={(e) => patchEstado(lote.id, { nome: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                              Imobiliária(s)/corretor(es) — um rascunho pra cada
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                className="pl-8"
                                placeholder="Buscar imobiliária ou corretor pelo nome..."
                                value={estado.buscaDestino}
                                onChange={(e) => buscarDestinos(lote, e.target.value)}
                              />
                            </div>
                            {estado.resultadosBuscaDestino.length > 0 && (
                              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-1">
                                {estado.resultadosBuscaDestino.map((r) => (
                                  <li key={chaveDestino(r)}>
                                    <button
                                      type="button"
                                      onClick={() => adicionarDestino(lote.id, r)}
                                      className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                                    >
                                      {r.corretorId ? (
                                        <User className="h-3 w-3 shrink-0" />
                                      ) : (
                                        <Building2 className="h-3 w-3 shrink-0" />
                                      )}
                                      {r.label}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {estado.destinos.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {estado.destinos.map((d) => (
                                  <Badge
                                    key={chaveDestino(d)}
                                    variant="secondary"
                                    className="flex items-center gap-1 pr-1 text-[11px]"
                                  >
                                    {d.corretorId ? (
                                      <User className="h-3 w-3" />
                                    ) : (
                                      <Building2 className="h-3 w-3" />
                                    )}
                                    {d.label}
                                    <button
                                      type="button"
                                      onClick={() => removerDestino(lote.id, d)}
                                      className="ml-0.5 rounded hover:bg-black/10"
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {fonte?.tipo_alvo === "empreendimento" ? (
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <Label className="text-xs uppercase text-muted-foreground">
                                Unidades ({estado.unidades.length}) — extraídas do PDF, edite antes
                                de aprovar
                              </Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addUnidade(lote.id)}
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Unidade
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {estado.unidades.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Nenhuma unidade extraída — adicione manualmente se necessário.
                                </p>
                              )}
                              {estado.unidades.map((u) => (
                                <div
                                  key={u.key}
                                  className="grid grid-cols-2 gap-1.5 rounded-md border border-border p-2 sm:grid-cols-7"
                                >
                                  <Input
                                    className="h-8 text-xs"
                                    placeholder="Bloco"
                                    value={u.bloco ?? ""}
                                    onChange={(e) =>
                                      patchUnidade(lote.id, u.key, {
                                        bloco: e.target.value || null,
                                      })
                                    }
                                  />
                                  <NumberInput
                                    className="h-8 text-xs"
                                    placeholder="Andar"
                                    value={u.andar}
                                    onChange={(v) => patchUnidade(lote.id, u.key, { andar: v })}
                                  />
                                  <Input
                                    className="h-8 text-xs"
                                    placeholder="Número *"
                                    value={u.numero}
                                    onChange={(e) =>
                                      patchUnidade(lote.id, u.key, { numero: e.target.value })
                                    }
                                  />
                                  <Input
                                    className="h-8 text-xs"
                                    placeholder="Tipo/planta"
                                    value={u.tipo_planta ?? ""}
                                    onChange={(e) =>
                                      patchUnidade(lote.id, u.key, {
                                        tipo_planta: e.target.value || null,
                                      })
                                    }
                                  />
                                  <NumberInput
                                    className="h-8 text-xs"
                                    placeholder="Área m²"
                                    value={u.area}
                                    onChange={(v) => patchUnidade(lote.id, u.key, { area: v })}
                                  />
                                  <NumberInput
                                    className="h-8 text-xs"
                                    placeholder="Preço"
                                    value={u.preco}
                                    onChange={(v) => patchUnidade(lote.id, u.key, { preco: v })}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-destructive"
                                    onClick={() => removerUnidade(lote.id, u.key)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                                Preço
                              </Label>
                              <NumberInput
                                value={estado.imovelPreco}
                                onChange={(v) => patchEstado(lote.id, { imovelPreco: v })}
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                                Área total (m²)
                              </Label>
                              <NumberInput
                                value={estado.imovelArea}
                                onChange={(v) => patchEstado(lote.id, { imovelArea: v })}
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                                Quartos
                              </Label>
                              <NumberInput
                                value={estado.imovelQuartos}
                                onChange={(v) => patchEstado(lote.id, { imovelQuartos: v })}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                                Descrição
                              </Label>
                              <Textarea
                                rows={2}
                                value={estado.imovelDescricao}
                                onChange={(e) =>
                                  patchEstado(lote.id, { imovelDescricao: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="mb-2 block text-xs uppercase text-muted-foreground">
                            Mídias ({estado.midiasSelecionadas.size} selecionada(s) de{" "}
                            {estado.midias?.filter((m) => m.tipo !== "video").length ?? 0})
                          </Label>
                          {estado.midias === null && (
                            <p className="text-xs text-muted-foreground">Carregando mídias...</p>
                          )}
                          {estado.midias?.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Nenhuma mídia encontrada.
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                            {estado.midias
                              ?.filter((m) => m.tipo !== "video")
                              .map((m) => (
                                <button
                                  type="button"
                                  key={m.id}
                                  onClick={() => toggleMidia(lote.id, m.id)}
                                  className={`group relative overflow-hidden rounded-md border text-left ${
                                    estado.midiasSelecionadas.has(m.id)
                                      ? "border-primary ring-2 ring-primary"
                                      : "border-border"
                                  }`}
                                >
                                  {m.thumbnail_url ? (
                                    <img
                                      src={m.thumbnail_url}
                                      alt={m.legenda_ia ?? ""}
                                      className="aspect-square w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-square w-full items-center justify-center bg-muted">
                                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="absolute left-1 top-1">
                                    <Checkbox checked={estado.midiasSelecionadas.has(m.id)} />
                                  </div>
                                  {m.score_ia != null && (
                                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                                      {Math.round(m.score_ia)}
                                    </span>
                                  )}
                                </button>
                              ))}
                          </div>
                          {estado.midias?.some((m) => m.tipo === "video") && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Video className="h-3.5 w-3.5" />
                              {estado.midias.filter((m) => m.tipo === "video").length} vídeo(s)
                              encontrado(s) — não copiado automaticamente, veja na origem.
                            </p>
                          )}
                          {Object.keys(lote.dados_extraidos ?? {}).length > 0 && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" /> Preços/unidades acima extraídos
                              automaticamente de PDF — confira antes de aprovar.
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border pt-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={estado.salvando}
                            onClick={() => rejeitar(lote)}
                          >
                            Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            disabled={estado.salvando}
                            onClick={() => aprovar(lote)}
                          >
                            {estado.salvando
                              ? "Salvando..."
                              : lote.status === "aprovado"
                                ? "Aprovar pra mais destinos"
                                : "Aprovar e criar rascunho"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
