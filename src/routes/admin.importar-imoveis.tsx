import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import {
  sincronizarIngestaoAgora,
  obterThumbnailsFrescos,
  aprovarLote,
  extrairImovelDeUrl,
} from "@/lib/construtoraIngestao.functions";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Star,
  Check,
  Link2,
  Building2,
  Factory,
  Loader2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/admin/importar-imoveis")({
  validateSearch: (s: Record<string, unknown>): { construtora?: string } => ({
    construtora: typeof s.construtora === "string" ? s.construtora : undefined,
  }),
  component: AssistenteImportacaoPage,
});

// Assistente de importação de imóveis — wizard didático STANDALONE (área própria
// em /admin/importar-imoveis, não mais preso a uma construtora pela URL). Passo
// 0 escolhe/cria a construtora; o resto conduz o fluxo inteiro (fontes →
// importar → revisar fotos/capa/campos → publicar em massa), reusando as server
// functions maduras da ingestão. As telas antigas (cadastro de fontes em
// /admin/construtoras e /admin/construtoras/$id/ingestao) seguem como "modo
// avançado". Fase 1: Linktree/Drive; Fase 2: link do anúncio (URL); Fase 3: CSV.

type Tipo = "empreendimento" | "imovel";
type Fonte = {
  id: string;
  nome: string;
  url: string;
  tipo_alvo: Tipo;
  intervalo_horas: number;
  origem: string;
};
type Unidade = { numero: string; bloco: string | null; area: number | null; preco: number | null };
// dados_extraidos carrega tanto as unidades (empreendimento, extraídas de PDF)
// quanto os campos de imóvel (Fase 2, extraídos do link do anúncio) — o wizard
// pré-preenche a revisão a partir daí.
type DadosExtraidos = {
  unidades?: Unidade[];
  preco?: number | null;
  area_total?: number | null;
  area_util?: number | null;
  quartos?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  descricao?: string | null;
  tipo?: string | null;
  finalidade?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  endereco_bairro?: string | null;
  endereco_logradouro?: string | null;
};
type Lote = {
  id: string;
  fonte_id: string;
  nome_bruto: string;
  status: string;
  dados_extraidos: DadosExtraidos | null;
  tipo_alvo_override: Tipo | null;
};
type Midia = { id: string; tipo: string; recomendada: boolean; thumbnailUrl: string | null };
type Destino = { tenantId: string; corretorId: string | null; label: string };

type CamposImovel = {
  finalidade: string;
  tipo: string;
  preco: number | null;
  condominio: number | null;
  iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_bairro: string;
  endereco_logradouro: string;
  descricao: string;
};

type EstadoLote = {
  incluir: boolean;
  nome: string;
  tipo: Tipo;
  midias: Midia[] | null;
  selecionadas: Set<string>;
  capaMidiaId: string | null;
  campos: CamposImovel;
  unidades: Unidade[];
};

function camposVazios(): CamposImovel {
  return {
    finalidade: "venda",
    tipo: "apartamento",
    preco: null,
    condominio: null,
    iptu: null,
    area_total: null,
    area_util: null,
    quartos: null,
    suites: null,
    banheiros: null,
    vagas: null,
    endereco_cidade: "",
    endereco_uf: "",
    endereco_bairro: "",
    endereco_logradouro: "",
    descricao: "",
  };
}

// Pré-preenche os campos do imóvel a partir do que a ingestão extraiu (Fase 2:
// link do anúncio; também aproveita qualquer dado já vindo do PDF/IA). Só
// sobrescreve o default quando há valor — o super_admin sempre confere/edita.
function camposDeDados(d: DadosExtraidos | null): CamposImovel {
  const base = camposVazios();
  if (!d) return base;
  return {
    ...base,
    finalidade: d.finalidade || base.finalidade,
    tipo: d.tipo || base.tipo,
    preco: d.preco ?? base.preco,
    area_total: d.area_total ?? base.area_total,
    area_util: d.area_util ?? base.area_util,
    quartos: d.quartos ?? base.quartos,
    suites: d.suites ?? base.suites,
    banheiros: d.banheiros ?? base.banheiros,
    vagas: d.vagas ?? base.vagas,
    endereco_cidade: d.endereco_cidade || base.endereco_cidade,
    endereco_uf: d.endereco_uf || base.endereco_uf,
    endereco_bairro: d.endereco_bairro || base.endereco_bairro,
    endereco_logradouro: d.endereco_logradouro || base.endereco_logradouro,
    descricao: d.descricao || base.descricao,
  };
}

const PASSOS = ["Construtora", "Fontes", "Importar", "Revisar", "Publicar"];

type Construtora = { id: string; nome: string };

function slugConstrutora(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function AssistenteImportacaoPage() {
  // Construtora escolhida no passo 0 (o wizard é standalone, não fica mais
  // preso a uma construtora pela URL — um import por link pode ser de qualquer
  // construtora). Aceita ?construtora=<id> pra pré-selecionar (atalho vindo de
  // /admin/construtoras).
  const search = Route.useSearch();
  const [id, setId] = useState<string>(search.construtora ?? "");
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [novaConstrutora, setNovaConstrutora] = useState("");
  const [criandoConstrutora, setCriandoConstrutora] = useState(false);

  const fnSync = useServerFn(sincronizarIngestaoAgora);
  const fnThumbs = useServerFn(obterThumbnailsFrescos);
  const fnAprovar = useServerFn(aprovarLote);

  const [passo, setPasso] = useState(0);
  const [nomeConstrutora, setNomeConstrutora] = useState("");

  // Passo 1 — fontes
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [nova, setNova] = useState({
    nome: "",
    url: "",
    tipo_alvo: "empreendimento" as Tipo,
    intervalo_horas: 24,
  });
  const [criando, setCriando] = useState(false);

  // Passo 1 — importar por link de anúncio (Fase 2)
  const fnExtrair = useServerFn(extrairImovelDeUrl);
  const [urlAnuncio, setUrlAnuncio] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  // A fonte sintética de imports por URL (origem='url') não é uma fonte
  // periódica — some da lista, mas seu id continua em `fontes` pros lotes dela
  // aparecerem na revisão (carregarLotes usa fontes.map).
  const fontesPeriodicas = fontes.filter((f) => f.origem !== "url");

  // Passo 2 — importar
  const [sincronizando, setSincronizando] = useState(false);

  // Passo 3/4 — lotes + estados + destinos
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoLote>>({});
  const [buscaDestino, setBuscaDestino] = useState("");
  const [resultados, setResultados] = useState<Destino[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [publicando, setPublicando] = useState(false);
  // Opt-in explícito: por padrão cria rascunho (seguro); marcado, já publica
  // no site do destino sem precisar do passo manual em /app/imoveis.
  const [publicaImediato, setPublicaImediato] = useState(false);

  async function carregarConstrutoras() {
    const { data } = await supabase.from("construtoras").select("id,nome").order("nome");
    setConstrutoras((data ?? []) as Construtora[]);
  }

  async function carregarBase() {
    if (!id) {
      setNomeConstrutora("");
      setFontes([]);
      return;
    }
    const [{ data: c }, { data: fs }] = await Promise.all([
      supabase.from("construtoras").select("nome").eq("id", id).maybeSingle(),
      supabase
        .from("construtora_fontes_ingestao")
        .select("id,nome,url,tipo_alvo,intervalo_horas,origem")
        .eq("construtora_id", id)
        .order("created_at"),
    ]);
    setNomeConstrutora((c as { nome: string } | null)?.nome ?? "");
    setFontes((fs ?? []) as unknown as Fonte[]);
  }

  useEffect(() => {
    carregarConstrutoras();
  }, []);

  useEffect(() => {
    carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function criarConstrutora() {
    const nome = novaConstrutora.trim();
    if (!nome) return toast.error("Informe o nome da construtora.");
    setCriandoConstrutora(true);
    const slug = slugConstrutora(nome);
    const { data, error } = await supabase
      .from("construtoras")
      .insert({ nome, slug })
      .select("id,nome")
      .single();
    setCriandoConstrutora(false);
    if (error || !data) return toast.error("Erro ao criar construtora: " + (error?.message ?? ""));
    toast.success(`Construtora "${nome}" criada.`);
    setNovaConstrutora("");
    await carregarConstrutoras();
    setId(data.id);
  }

  async function criarFonte() {
    if (!nova.nome.trim() || !nova.url.trim()) {
      toast.error("Informe nome e URL (Linktree) da fonte.");
      return;
    }
    setCriando(true);
    const { error } = await supabase.from("construtora_fontes_ingestao").insert({
      construtora_id: id,
      nome: nova.nome.trim(),
      url: nova.url.trim(),
      tipo_alvo: nova.tipo_alvo,
      intervalo_horas: nova.intervalo_horas,
    });
    setCriando(false);
    if (error) return toast.error("Erro ao cadastrar fonte: " + error.message);
    toast.success("Fonte cadastrada.");
    setNova({ nome: "", url: "", tipo_alvo: "empreendimento", intervalo_horas: 24 });
    carregarBase();
  }

  async function importarPorUrl() {
    const url = urlAnuncio.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Cole o link completo do anúncio (começando com https://).");
      return;
    }
    setExtraindo(true);
    try {
      const r = (await fnExtrair({ data: { construtoraId: id, url } })) as {
        titulo: string;
        camposComValor: number;
        imagens: number;
        origens: string[];
      };
      const usouIA = r.origens.includes("ia");
      toast.success(
        `Anúncio importado: "${r.titulo}" — ${r.camposComValor} campo(s) e ${r.imagens} foto(s).` +
          (usouIA ? " (alguns campos vieram da IA — confira na revisão.)" : ""),
      );
      setUrlAnuncio("");
      await carregarBase();
      await carregarLotes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar o anúncio.");
    } finally {
      setExtraindo(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      await fnSync({ data: { construtora_id: id } });
      toast.success("Importação iniciada — varrendo Linktree e Google Drive em segundo plano.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar importação");
    } finally {
      setSincronizando(false);
    }
  }

  async function carregarLotes() {
    const fonteIds = fontes.map((f) => f.id);
    if (fonteIds.length === 0) {
      setLotes([]);
      return;
    }
    const { data } = await supabase
      .from("construtora_ingestao_lotes")
      .select("id,fonte_id,nome_bruto,status,dados_extraidos,tipo_alvo_override")
      .in("fonte_id", fonteIds)
      .eq("status", "pronto_revisao")
      .order("created_at", { ascending: false });
    setLotes((data ?? []) as unknown as Lote[]);
  }

  function estadoDe(lote: Lote): EstadoLote {
    return (
      estados[lote.id] ?? {
        incluir: false,
        nome: lote.nome_bruto,
        tipo:
          lote.tipo_alvo_override ??
          fontes.find((f) => f.id === lote.fonte_id)?.tipo_alvo ??
          "imovel",
        midias: null,
        selecionadas: new Set(),
        capaMidiaId: null,
        campos: camposDeDados(lote.dados_extraidos),
        unidades: lote.dados_extraidos?.unidades ?? [],
      }
    );
  }

  function patch(loteId: string, p: Partial<EstadoLote>, base: EstadoLote) {
    setEstados((prev) => ({ ...prev, [loteId]: { ...base, ...p } }));
  }

  async function carregarFotos(lote: Lote, base: EstadoLote) {
    const { data: midias } = await supabase
      .from("construtora_ingestao_midias")
      .select("id,tipo,recomendada")
      .eq("lote_id", lote.id)
      .neq("tipo", "pdf_tabela")
      .neq("tipo", "video");
    const lista = (midias ?? []) as { id: string; tipo: string; recomendada: boolean }[];
    const ids = lista.map((m) => m.id);
    const thumbs = ids.length
      ? ((await fnThumbs({ data: { midiaIds: ids } })) as {
          id: string;
          thumbnailUrl: string | null;
        }[])
      : [];
    const thumbMap = new Map(thumbs.map((t) => [t.id, t.thumbnailUrl]));
    const midiasFull: Midia[] = lista.map((m) => ({
      ...m,
      thumbnailUrl: thumbMap.get(m.id) ?? null,
    }));
    const selecionadas = new Set(lista.filter((m) => m.recomendada).map((m) => m.id));
    const capa = midiasFull.find((m) => selecionadas.has(m.id) && m.thumbnailUrl)?.id ?? null;
    patch(lote.id, { midias: midiasFull, selecionadas, capaMidiaId: capa }, base);
  }

  async function buscarDestinos(termo: string) {
    setBuscaDestino(termo);
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    const [{ data: ts }, { data: cs }] = await Promise.all([
      supabase.from("tenants").select("id,nome").ilike("nome", `%${termo}%`).limit(6),
      supabase.from("corretores").select("id,nome,tenant_id").ilike("nome", `%${termo}%`).limit(6),
    ]);
    const res: Destino[] = [
      ...((ts ?? []) as { id: string; nome: string }[]).map((t) => ({
        tenantId: t.id,
        corretorId: null,
        label: `${t.nome} (imobiliária)`,
      })),
      ...((cs ?? []) as { id: string; nome: string; tenant_id: string }[]).map((c) => ({
        tenantId: c.tenant_id,
        corretorId: c.id,
        label: `${c.nome} (corretor)`,
      })),
    ];
    setResultados(res);
  }

  function addDestino(d: Destino) {
    setDestinos((prev) =>
      prev.some((x) => x.tenantId === d.tenantId && x.corretorId === d.corretorId)
        ? prev
        : [...prev, d],
    );
    setBuscaDestino("");
    setResultados([]);
  }

  const selecionadosLotes = lotes.filter((l) => estadoDe(l).incluir);

  async function publicar() {
    if (destinos.length === 0) return toast.error("Escolha ao menos um destino.");
    if (selecionadosLotes.length === 0)
      return toast.error("Marque ao menos um imóvel para publicar.");
    setPublicando(true);
    // Conta destinos que de fato deram certo (não lotes) — aprovarLote roda
    // cada destino isolado e devolve um `erro` por destino sem lançar
    // exceção, então contar só "não lançou" reportaria sucesso falso.
    let okDestinos = 0;
    let erroDestinos = 0;
    for (const lote of selecionadosLotes) {
      const e = estadoDe(lote);
      try {
        const resp = await fnAprovar({
          data: {
            loteId: lote.id,
            tipoAlvo: e.tipo,
            destinos: destinos.map((d) => ({ tenantId: d.tenantId, corretorId: d.corretorId })),
            midiaIds: Array.from(e.selecionadas),
            capaMidiaId: e.capaMidiaId,
            publicar: publicaImediato,
            nome: e.nome,
            unidades: e.tipo === "empreendimento" ? e.unidades : undefined,
            imovel:
              e.tipo === "imovel"
                ? {
                    finalidade: e.campos.finalidade,
                    tipo: e.campos.tipo,
                    preco: e.campos.preco,
                    condominio: e.campos.condominio,
                    iptu: e.campos.iptu,
                    area_total: e.campos.area_total,
                    area_util: e.campos.area_util,
                    quartos: e.campos.quartos,
                    suites: e.campos.suites,
                    banheiros: e.campos.banheiros,
                    vagas: e.campos.vagas,
                    endereco_cidade: e.campos.endereco_cidade || null,
                    endereco_uf: e.campos.endereco_uf || null,
                    endereco_bairro: e.campos.endereco_bairro || null,
                    endereco_logradouro: e.campos.endereco_logradouro || null,
                    descricao: e.campos.descricao || null,
                  }
                : undefined,
          },
        });
        const rs = (resp as { resultados?: { erro?: string }[] })?.resultados ?? [];
        for (const r of rs) {
          if (r.erro) {
            erroDestinos++;
            toast.error(`"${e.nome}": ${r.erro}`);
          } else {
            okDestinos++;
          }
        }
      } catch (err) {
        erroDestinos += destinos.length;
        toast.error(`Falha em "${e.nome}": ${err instanceof Error ? err.message : "erro"}`);
      }
    }
    setPublicando(false);
    if (okDestinos > 0) {
      const alvo = `${okDestinos} publicação(ões) em ${destinos.length} destino(s)`;
      toast.success(
        publicaImediato
          ? `${alvo} publicada(s) — já aparecem no site do destino.`
          : `${alvo} criada(s) como rascunho. Para aparecerem no site, publique em /app/imoveis (ou /app/empreendimentos), ou marque "Publicar imediatamente".`,
      );
    } else if (erroDestinos > 0) {
      toast.error("Nenhuma publicação concluída — veja os erros acima.");
    }
    carregarLotes();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Assistente de importação de imóveis {nomeConstrutora && `— ${nomeConstrutora}`}
        </h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {PASSOS.map((nome, i) => (
          <div key={nome} className="flex items-center gap-2">
            <div
              className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                i === passo
                  ? "bg-primary text-primary-foreground"
                  : i < passo
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < passo ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              {nome}
            </div>
            {i < PASSOS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Passo 0 — Construtora */}
      {passo === 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Escolha a <strong>construtora</strong> à qual os imóveis importados vão pertencer. Todo
            o resto do assistente (fontes, importação por link, revisão e publicação) fica ligado a
            ela. Se a construtora ainda não existe, crie aqui mesmo.
          </p>
          <div>
            <Label className="text-xs">Construtora</Label>
            <Select value={id} onValueChange={setId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma construtora…" />
              </SelectTrigger>
              <SelectContent>
                {construtoras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Ou criar uma nova construtora
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={novaConstrutora}
                onChange={(e) => setNovaConstrutora(e.target.value)}
                placeholder="Nome da construtora (ex.: Cury)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !criandoConstrutora) criarConstrutora();
                }}
              />
              <Button
                variant="outline"
                onClick={criarConstrutora}
                disabled={criandoConstrutora}
                className="gap-1.5"
              >
                {criandoConstrutora ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Criar e usar
              </Button>
            </div>
          </div>
          {id && (
            <p className="text-sm text-primary">
              Construtora selecionada: <strong>{nomeConstrutora}</strong>. Clique em Avançar.
            </p>
          )}
        </div>
      )}

      {/* Passo 1 — Fontes */}
      {passo === 1 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Cadastre uma ou mais fontes de onde os imóveis serão importados. Hoje o formato
            suportado é o <strong>Linktree da construtora</strong> (que aponta para pastas do Google
            Drive com fotos, plantas e tabelas de preço). Você pode adicionar várias fontes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome da fonte</Label>
              <Input
                value={nova.nome}
                onChange={(e) => setNova({ ...nova, nome: e.target.value })}
                placeholder="Ex.: Lançamentos GMV"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">URL (Linktree)</Label>
              <Input
                value={nova.url}
                onChange={(e) => setNova({ ...nova, url: e.target.value })}
                placeholder="https://linktr.ee/..."
              />
            </div>
            <div>
              <Label className="text-xs">Tipo padrão</Label>
              <Select
                value={nova.tipo_alvo}
                onValueChange={(v) => setNova({ ...nova, tipo_alvo: v as Tipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empreendimento">Empreendimento / lançamento</SelectItem>
                  <SelectItem value="imovel">Imóvel avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sincronizar a cada (horas)</Label>
              <NumberInput
                value={nova.intervalo_horas}
                onChange={(v) => setNova({ ...nova, intervalo_horas: v ?? 24 })}
              />
            </div>
          </div>
          <Button onClick={criarFonte} disabled={criando} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar fonte
          </Button>

          {fontesPeriodicas.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Fontes cadastradas ({fontesPeriodicas.length})
              </p>
              {fontesPeriodicas.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-sm"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{f.nome}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {f.tipo_alvo === "empreendimento" ? "Lançamento" : "Avulso"}
                  </Badge>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{f.url}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fase 2 — importar direto de um link de anúncio */}
          <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Importar de um link de anúncio</p>
              <Badge variant="outline" className="text-[10px]">
                novo
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole o link de um anúncio no site da construtora. O assistente lê a página e
              pré-preenche preço, área, descrição e fotos automaticamente (o que não vier
              estruturado é completado por IA). Você confere tudo na etapa de revisão antes de
              publicar — nada é publicado sozinho.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={urlAnuncio}
                onChange={(e) => setUrlAnuncio(e.target.value)}
                placeholder="https://site-da-construtora.com.br/imovel/..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !extraindo) importarPorUrl();
                }}
              />
              <Button onClick={importarPorUrl} disabled={extraindo} className="gap-1.5">
                {extraindo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Importar link
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O imóvel importado aparece na etapa <strong>Revisar</strong>, junto com os das outras
              fontes.
            </p>
          </div>
        </div>
      )}

      {/* Passo 2 — Importar */}
      {passo === 2 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Ao importar, o sistema varre as fontes (Linktree → Google Drive), descobre os imóveis e
            usa IA para recomendar as melhores fotos. O processo roda em segundo plano e pode levar
            alguns minutos. Nada é publicado automaticamente — tudo cai na revisão do próximo passo.
          </p>
          <Button
            onClick={sincronizar}
            disabled={sincronizando || fontes.length === 0}
            className="gap-1.5"
          >
            {sincronizando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Importar agora
          </Button>
          {fontes.length === 0 && (
            <p className="text-xs text-destructive">
              Cadastre ao menos uma fonte no passo anterior.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Já importou antes? Pode seguir direto para “Revisar” — os imóveis já descobertos
            aparecem lá.
          </p>
        </div>
      )}

      {/* Passo 3 — Revisar */}
      {passo === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Marque os imóveis que quer publicar, escolha as fotos, defina a <strong>capa</strong> e
            complete os dados. Você publica todos os marcados de uma vez no próximo passo.
          </p>
          {lotes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum imóvel pendente de revisão. Importe no passo anterior (aguarde alguns minutos e
              recarregue) ou verifique as fontes.
            </p>
          ) : (
            lotes.map((lote) => {
              const e = estadoDe(lote);
              return (
                <div key={lote.id} className="rounded-xl border border-border bg-card p-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={e.incluir}
                      onChange={(ev) => {
                        patch(lote.id, { incluir: ev.target.checked }, e);
                        if (ev.target.checked && e.midias === null)
                          carregarFotos(lote, { ...e, incluir: true });
                      }}
                    />
                    <span className="font-semibold">{lote.nome_bruto}</span>
                  </label>

                  {e.incluir && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Nome do anúncio</Label>
                          <Input
                            value={e.nome}
                            onChange={(ev) => patch(lote.id, { nome: ev.target.value }, e)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={e.tipo}
                            onValueChange={(v) => patch(lote.id, { tipo: v as Tipo }, e)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="imovel">Imóvel avulso</SelectItem>
                              <SelectItem value="empreendimento">Empreendimento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Fotos + capa */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Fotos{" "}
                          {e.midias ? `(${e.selecionadas.size} selecionadas)` : "(carregando…)"} —
                          clique na estrela para definir a capa
                        </p>
                        {e.midias === null ? (
                          <p className="text-xs text-muted-foreground">Carregando fotos…</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {e.midias
                              .filter((m) => m.thumbnailUrl)
                              .map((m) => {
                                const sel = e.selecionadas.has(m.id);
                                return (
                                  <div key={m.id} className="relative">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ns = new Set(e.selecionadas);
                                        if (ns.has(m.id)) ns.delete(m.id);
                                        else ns.add(m.id);
                                        const capa =
                                          e.capaMidiaId && ns.has(e.capaMidiaId)
                                            ? e.capaMidiaId
                                            : (ns.values().next().value ?? null);
                                        patch(lote.id, { selecionadas: ns, capaMidiaId: capa }, e);
                                      }}
                                      className={`block aspect-square w-full overflow-hidden rounded-md border-2 ${
                                        sel ? "border-primary" : "border-transparent opacity-60"
                                      }`}
                                    >
                                      <img
                                        src={m.thumbnailUrl!}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    </button>
                                    {sel && (
                                      <button
                                        type="button"
                                        title="Definir como capa"
                                        onClick={() => patch(lote.id, { capaMidiaId: m.id }, e)}
                                        className={`absolute left-1 top-1 rounded-full p-1 ${
                                          e.capaMidiaId === m.id
                                            ? "bg-amber-400 text-black"
                                            : "bg-black/50 text-white"
                                        }`}
                                      >
                                        <Star
                                          className="h-3 w-3"
                                          fill={e.capaMidiaId === m.id ? "currentColor" : "none"}
                                        />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Campos — imóvel avulso (paridade com /app/imoveis/novo) */}
                      {e.tipo === "imovel" ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <Label className="text-xs">Finalidade</Label>
                            <Select
                              value={e.campos.finalidade}
                              onValueChange={(v) =>
                                patch(lote.id, { campos: { ...e.campos, finalidade: v } }, e)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(FINALIDADE_LABEL).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Tipo de imóvel</Label>
                            <Select
                              value={e.campos.tipo}
                              onValueChange={(v) =>
                                patch(lote.id, { campos: { ...e.campos, tipo: v } }, e)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <NumField
                            label="Preço (R$)"
                            value={e.campos.preco}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, preco: v } }, e)
                            }
                          />
                          <NumField
                            label="Condomínio"
                            value={e.campos.condominio}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, condominio: v } }, e)
                            }
                          />
                          <NumField
                            label="IPTU"
                            value={e.campos.iptu}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, iptu: v } }, e)
                            }
                          />
                          <NumField
                            label="Área total (m²)"
                            value={e.campos.area_total}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, area_total: v } }, e)
                            }
                          />
                          <NumField
                            label="Área útil (m²)"
                            value={e.campos.area_util}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, area_util: v } }, e)
                            }
                          />
                          <NumField
                            label="Quartos"
                            value={e.campos.quartos}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, quartos: v } }, e)
                            }
                          />
                          <NumField
                            label="Suítes"
                            value={e.campos.suites}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, suites: v } }, e)
                            }
                          />
                          <NumField
                            label="Banheiros"
                            value={e.campos.banheiros}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, banheiros: v } }, e)
                            }
                          />
                          <NumField
                            label="Vagas"
                            value={e.campos.vagas}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, vagas: v } }, e)
                            }
                          />
                          <TxtField
                            label="Cidade"
                            value={e.campos.endereco_cidade}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, endereco_cidade: v } }, e)
                            }
                          />
                          <TxtField
                            label="UF"
                            value={e.campos.endereco_uf}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, endereco_uf: v } }, e)
                            }
                          />
                          <TxtField
                            label="Bairro"
                            value={e.campos.endereco_bairro}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, endereco_bairro: v } }, e)
                            }
                          />
                          <TxtField
                            label="Logradouro"
                            value={e.campos.endereco_logradouro}
                            onChange={(v) =>
                              patch(lote.id, { campos: { ...e.campos, endereco_logradouro: v } }, e)
                            }
                          />
                          <div className="sm:col-span-3">
                            <Label className="text-xs">Descrição</Label>
                            <Textarea
                              value={e.campos.descricao}
                              onChange={(ev) =>
                                patch(
                                  lote.id,
                                  { campos: { ...e.campos, descricao: ev.target.value } },
                                  e,
                                )
                              }
                              rows={3}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Empreendimento: {e.unidades.length} unidade(s) importada(s) serão criadas.
                          Para editar as unidades em detalhe, use o modo avançado ({" "}
                          <Link
                            className="text-primary hover:underline"
                            to="/admin/construtoras/$id/ingestao"
                            params={{ id }}
                          >
                            revisão detalhada
                          </Link>
                          ).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Passo 4 — Publicar */}
      {passo === 4 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Escolha para quais imobiliárias e/ou corretores os {selecionadosLotes.length} imóvel(is)
            marcado(s) serão criados (cada destino recebe um registro independente). Por padrão são
            criados como <strong>rascunho</strong> — não aparecem no site até serem publicados em
            /app/imoveis (ou /app/empreendimentos). Marque a opção abaixo para publicar já.
          </p>
          <div className="relative">
            <Input
              value={buscaDestino}
              onChange={(e) => buscarDestinos(e.target.value)}
              placeholder="Buscar imobiliária ou corretor…"
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                {resultados.map((r) => (
                  <button
                    key={`${r.tenantId}:${r.corretorId ?? ""}`}
                    onClick={() => addDestino(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {r.corretorId ? (
                      <Building2 className="mr-1 inline h-3.5 w-3.5" />
                    ) : (
                      <Factory className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {destinos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {destinos.map((d) => (
                <Badge
                  key={`${d.tenantId}:${d.corretorId ?? ""}`}
                  variant="secondary"
                  className="gap-1"
                >
                  {d.label}
                  <button
                    onClick={() =>
                      setDestinos((prev) =>
                        prev.filter(
                          (x) => !(x.tenantId === d.tenantId && x.corretorId === d.corretorId),
                        ),
                      )
                    }
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <Checkbox
              checked={publicaImediato}
              onCheckedChange={(v) => setPublicaImediato(v === true)}
              className="mt-0.5"
            />
            <span>
              <strong>Publicar imediatamente</strong> — os imóveis já aparecem no site do destino,
              sem o passo manual de publicação. Deixe desmarcado para criar como rascunho e revisar
              antes.
            </span>
          </label>
          <Button onClick={publicar} disabled={publicando} size="lg" className="gap-1.5">
            {publicando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {publicaImediato ? "Publicar" : "Criar rascunho de"} {selecionadosLotes.length}{" "}
            imóvel(is) para {destinos.length} destino(s)
          </Button>
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          disabled={passo === 0}
          onClick={() => setPasso((p) => p - 1)}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {passo < PASSOS.length - 1 && (
          <Button
            onClick={() => {
              if (passo === 2) carregarLotes(); // ao entrar em Revisar, carrega os lotes
              setPasso((p) => p + 1);
            }}
            disabled={passo === 0 && !id}
            className="gap-1.5"
          >
            Avançar <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <NumberInput value={value} onChange={onChange} />
    </div>
  );
}

function TxtField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
