import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Home,
  ArrowLeft,
  BookOpen,
  MapPin,
  Ruler,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import {
  estimarValorImovel,
  TIPO_AVALIACAO_LABEL,
  PADRAO_LABEL,
  CONSERVACAO_LABEL,
  type TipoImovelAvaliacao,
  type FinalidadeAvaliacao,
  type PadraoImovel,
  type ConservacaoImovel,
} from "@/lib/avaliacaoImovel";

export const Route = createFileRoute("/calculadora-avaliacao")({
  component: AvaliacaoPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Valor de Imóvel — Simule quanto vale seu imóvel — imob365" },
      {
        name: "description",
        content:
          "Descubra uma estimativa de valor do seu imóvel a partir do CEP, metragem, tipo e padrão. Ferramenta gratuita de referência para compra, venda e locação.",
      },
    ],
  }),
});

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.max(v, 0));

interface CepInfo {
  cidade: string;
  uf: string;
  bairro: string;
}

export function AvaliacaoPage() {
  const [cep, setCep] = useState("");
  const [cepInfo, setCepInfo] = useState<CepInfo | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [metragem, setMetragem] = useState<number>(70);
  const [tipo, setTipo] = useState<TipoImovelAvaliacao>("apartamento");
  const [finalidade, setFinalidade] = useState<FinalidadeAvaliacao>("venda");
  const [padrao, setPadrao] = useState<PadraoImovel>("medio");
  const [conservacao, setConservacao] = useState<ConservacaoImovel>("seminovo");

  async function handleCepChange(value: string) {
    const masked = value
      .replace(/\D/g, "")
      .slice(0, 8)
      .replace(/(\d{5})(\d)/, "$1-$2");
    setCep(masked);
    const clean = masked.replace(/\D/g, "");
    if (clean.length !== 8) {
      setCepInfo(null);
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const json = await res.json();
      if (json.erro) {
        setCepInfo(null);
        setCepStatus("erro");
        return;
      }
      setCepInfo({
        cidade: json.localidade ?? "",
        uf: json.uf ?? "",
        bairro: json.bairro ?? "",
      });
      setCepStatus("ok");
    } catch {
      setCepInfo(null);
      setCepStatus("erro");
    }
  }

  const resultado = useMemo(
    () =>
      estimarValorImovel({
        metragem,
        tipo,
        finalidade,
        padrao,
        conservacao,
        cidade: cepInfo?.cidade,
        uf: cepInfo?.uf,
      }),
    [metragem, tipo, finalidade, padrao, conservacao, cepInfo],
  );

  const localizacaoLabel = cepInfo
    ? [cepInfo.bairro, cepInfo.cidade, cepInfo.uf].filter(Boolean).join(", ")
    : null;

  return (
    <div className="min-h-screen bg-muted/20">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* LADO DA CALCULADORA (1 COLUNA) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sticky top-24">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
                  <Home className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-md font-bold text-foreground">Quanto vale meu imóvel?</h2>
                  <p className="text-3xs text-muted-foreground leading-none">
                    Estimativa por localização e metragem
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="aval-cep" className="text-xs font-bold text-muted-foreground">
                    CEP do imóvel
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="aval-cep"
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      className="pl-8 font-semibold text-sm"
                      placeholder="Ex: 11700-000"
                      inputMode="numeric"
                    />
                    {cepStatus === "loading" && (
                      <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {cepStatus === "ok" && localizacaoLabel && (
                    <span className="text-[10px] text-emerald-700 leading-tight block">
                      📍 {localizacaoLabel}
                    </span>
                  )}
                  {cepStatus === "erro" && (
                    <span className="text-[10px] text-destructive leading-tight block">
                      CEP não encontrado — usaremos a média nacional.
                    </span>
                  )}
                  {cepStatus === "idle" && (
                    <span className="text-[10px] text-muted-foreground leading-tight block">
                      Usamos o CEP só para localizar a região — nada é salvo.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as TipoImovelAvaliacao)}>
                      <SelectTrigger className="text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_AVALIACAO_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Finalidade</Label>
                    <Select
                      value={finalidade}
                      onValueChange={(v) => setFinalidade(v as FinalidadeAvaliacao)}
                    >
                      <SelectTrigger className="text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venda">Venda</SelectItem>
                        <SelectItem value="locacao">Locação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="aval-m2" className="text-xs font-bold text-muted-foreground">
                    Metragem (área privativa, m²)
                  </Label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="aval-m2"
                      type="number"
                      value={metragem || ""}
                      onChange={(e) => setMetragem(Number(e.target.value))}
                      className="pl-8 font-semibold text-sm"
                      placeholder="Ex: 70"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Padrão</Label>
                    <Select value={padrao} onValueChange={(v) => setPadrao(v as PadraoImovel)}>
                      <SelectTrigger className="text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PADRAO_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Conservação</Label>
                    <Select
                      value={conservacao}
                      onValueChange={(v) => setConservacao(v as ConservacaoImovel)}
                    >
                      <SelectTrigger className="text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONSERVACAO_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-3.5">
                  <div className="flex justify-between items-center bg-muted/45 p-3.5 rounded-xl border border-border/60">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-muted-foreground font-bold uppercase leading-none block">
                        {finalidade === "venda" ? "Valor estimado" : "Aluguel estimado"}
                      </span>
                      <span className="text-2xs text-muted-foreground leading-none block">
                        Faixa de referência
                      </span>
                    </div>
                    <span className="text-md font-extrabold text-emerald-600 text-right leading-tight">
                      {finalidade === "venda"
                        ? formatBRL(resultado.valorMedio)
                        : `${formatBRL(resultado.aluguelMedio ?? 0)}/mês`}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-xl border border-dashed border-border/80 text-3xs">
                    <span className="text-muted-foreground font-bold uppercase">
                      Faixa (mín. — máx.)
                    </span>
                    <span className="font-semibold text-foreground text-right">
                      {finalidade === "venda"
                        ? `${formatBRL(resultado.valorMinimo)} — ${formatBRL(resultado.valorMaximo)}`
                        : `${formatBRL(resultado.aluguelMinimo ?? 0)} — ${formatBRL(resultado.aluguelMaximo ?? 0)}`}
                    </span>
                  </div>

                  {finalidade === "locacao" && (
                    <div className="flex justify-between items-center p-3 rounded-xl border border-border/60 text-3xs">
                      <span className="text-muted-foreground font-bold uppercase">
                        Valor de mercado do imóvel (venda)
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(resultado.valorMedio)}
                      </span>
                    </div>
                  )}

                  <span className="text-[10px] text-muted-foreground block">
                    Base: {formatBRL(resultado.valorM2Ajustado)}/m² ·{" "}
                    {resultado.fonteRegional === "cidade"
                      ? "média da cidade informada"
                      : resultado.fonteRegional === "estado"
                        ? "média do estado (cidade não mapeada)"
                        : "média nacional (informe um CEP válido para refinar)"}
                  </span>
                </div>

                <div className="flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                  <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-400">
                    <strong>Isto é uma estimativa de referência</strong>, calculada por médias de
                    mercado — não é um laudo de avaliação. O valor real pode variar para mais ou
                    para menos conforme vista, sol, reformas, documentação e negociação. Para um
                    número confiável na hora de anunciar ou negociar, fale com um corretor
                    credenciado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CONTEÚDO EXPLICATIVO (2 COLUNAS) */}
          <div className="lg:col-span-2 space-y-8 bg-card border border-border p-6 md:p-8 rounded-2xl shadow-xs">
            <article className="prose prose-slate max-w-none space-y-6">
              <div className="space-y-2 border-b border-border pb-4">
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-850 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  <BookOpen className="h-3 w-3" /> Guia Educativo
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Como estimamos o valor do seu imóvel (e por que é só uma referência)
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tempo de leitura: 4 minutos • Ferramenta gratuita • Canal do Corretor
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" /> A metodologia por
                  trás do número
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A calculadora parte do <strong>valor médio do metro quadrado</strong> praticado na
                  região informada pelo CEP — cruzando dados públicos de mercado por cidade e estado
                  — e aplica ajustes conforme o <strong>tipo de imóvel</strong> (apartamento, casa,
                  terreno, comercial), o <strong>padrão</strong> (econômico até luxo) e o{" "}
                  <strong>estado de conservação</strong>. O resultado final é multiplicado pela{" "}
                  <strong>metragem privativa</strong> informada.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para locação, aplicamos uma regra prática usada no mercado imobiliário brasileiro:
                  o aluguel mensal costuma equivaler a algo entre 0,4% e 0,6% do valor de venda do
                  imóvel.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 p-5 rounded-xl space-y-2">
                <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> O que este número NÃO é
                </h3>
                <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-400/90">
                  Esta ferramenta <strong>não substitui uma Avaliação Mercadológica (CMI)</strong>{" "}
                  feita por um corretor credenciado, nem um laudo técnico de engenharia. Ela não
                  considera fatores decisivos como vista, posição solar, ruído, documentação
                  regularizada, liquidez do bairro ou condições específicas de negociação. Trate o
                  resultado como um <strong>ponto de partida para a conversa</strong>, não como o
                  preço final de um anúncio ou de uma proposta.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" /> Fatores que podem mudar o
                  valor real
                </h2>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
                  <li>
                    <strong>Localização exata dentro do bairro:</strong> proximidade de praia,
                    praça, metrô ou comércio altera bastante o preço por m².
                  </li>
                  <li>
                    <strong>Estado de conservação e reformas recentes:</strong> cozinha e banheiros
                    reformados costumam agregar valor acima da média.
                  </li>
                  <li>
                    <strong>Vaga de garagem, lazer e infraestrutura do condomínio.</strong>
                  </li>
                  <li>
                    <strong>Documentação:</strong> imóveis com matrícula regularizada e sem
                    pendências valem mais e vendem mais rápido.
                  </li>
                  <li>
                    <strong>Momento de mercado:</strong> oferta e demanda da região no momento do
                    anúncio.
                  </li>
                </ul>
              </div>

              <div className="bg-primary/[0.02] border border-primary/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Quer um número exato?
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fale com um dos corretores parceiros da imob365 para uma Avaliação Comparativa de
                  Mercado (CMI) gratuita e personalizada, feita com base em imóveis semelhantes
                  vendidos recentemente na sua região.
                </p>
              </div>
            </article>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
