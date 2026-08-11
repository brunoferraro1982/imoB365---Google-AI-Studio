import { SiteHeader, ConstrutorasMarquee } from "@/components/site-layout";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Globe2,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  Search,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  ArrowRight,
  Building,
  Instagram,
  Facebook,
  Linkedin,
  SlidersHorizontal,
  ChevronDown,
  Car,
  Key,
  CreditCard,
  Calculator,
  Calendar,
  Landmark,
  DollarSign,
  Scale,
  GraduationCap,
  Plug,
  BookOpen,
  Headset,
  QrCode,
  Briefcase,
  Radar,
  Gauge,
  MessageCircle,
  FileSignature,
  Wallet,
  Route as RouteIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL, imovelFotoUrl } from "@/lib/format";
import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";
import { comporDestaques, type TenantMeta } from "@/lib/featuredImoveis";
import { getVisitorRegion } from "@/lib/geo.functions";
import { AssistenteIASection } from "@/components/portal/AssistenteIASection";

import citySkylineHero from "@/assets/images/city_skyline_hero_1780319947399.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "imob365 — Encontre o imóvel certo, com quem entende do seu bairro" },
      {
        name: "description",
        content:
          "Milhares de imóveis para comprar e alugar, ofertados por imobiliárias e corretores parceiros em todo o Brasil. Cadastre-se grátis e comece a divulgar seus imóveis em minutos.",
      },
      {
        property: "og:title",
        content: "imob365 — Encontre o imóvel certo, com quem entende do seu bairro",
      },
      {
        property: "og:description",
        content:
          "Milhares de imóveis para comprar e alugar, ofertados por imobiliárias e corretores parceiros em todo o Brasil.",
      },
    ],
  }),
  component: Landing,
});

type ImovelCard = {
  id: string;
  slug: string | null;
  titulo: string;
  finalidade: string;
  tipo: string;
  preco: number | null;
  quartos: number | null;
  banheiros: number | null;
  area_util: number | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_bairro: string | null;
  capa: string | null;
  // usados pela composição da vitrine (região/intercalação/preferência)
  tenant_id: string | null;
  updated_at: string | null;
};

type TenantCard = {
  id: string;
  slug: string;
  nome: string;
  total: number;
  logoUrl: string | null;
  cidadesAtuacao: string[] | null;
  regiaoAtuacao: string | null;
};

type EmpreendCard = {
  id: string;
  slug: string;
  nome: string;
  construtora: string | null;
  fase: string;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_bairro: string | null;
  entrega_prevista: string | null;
  unidades_total: number | null;
  fotos_urls: string[];
  descricao: string | null;
};

const PHRASES = [
  "com quem entende do seu bairro.",
  "de acordo com sua necessidade.",
  "e realize seu sonho.",
];

function Landing() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const activePhrase = PHRASES[currentPhraseIndex];

    if (!isDeleting) {
      if (displayText.length < activePhrase.length) {
        timer = setTimeout(() => {
          setDisplayText(activePhrase.substring(0, displayText.length + 1));
          setTypingSpeed(100);
        }, typingSpeed);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
          setTypingSpeed(50);
        }, 2000);
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(activePhrase.substring(0, displayText.length - 1));
        }, typingSpeed);
      } else {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setTypingSpeed(150);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentPhraseIndex, typingSpeed]);

  const [imoveis, setImoveis] = useState<ImovelCard[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<EmpreendCard[]>([]);
  const [tenants, setTenants] = useState<TenantCard[]>([]);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [busca, setBusca] = useState("");
  const [finalidade, setFinalidade] = useState<"venda" | "aluguel">("venda");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adv, setAdv] = useState({
    tipo: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    precoMin: "",
    precoMax: "",
    areaMin: "",
    bairro: "",
  });

  useEffect(() => {
    (async () => {
      const [{ data }, region] = await Promise.all([
        supabase
          .from("imoveis")
          .select(
            "id,slug,titulo,finalidade,tipo,preco,quartos,banheiros,area_util,endereco_cidade,endereco_uf,endereco_bairro,tenant_id,updated_at,imovel_fotos(storage_path,capa,ordem)",
          )
          .eq("publicado", true)
          .eq("status", "ativo")
          // Pool maior que os 8 exibidos — a vitrine final é COMPOSTA em JS
          // (região do visitante + intercalação corretor/imobiliária +
          // preferência Bruno/imob365), não é mais só recência.
          .order("updated_at", { ascending: false })
          .limit(40),
        getVisitorRegion().catch(() => null),
      ]);
      const pool: ImovelCard[] = (data ?? []).map((d: any) => {
        const fotos = (d.imovel_fotos ?? [])
          .slice()
          .sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
        return { ...d, capa: fotos[0]?.storage_path ?? null };
      });
      // Metadados do tenant (slug/tipo) pra classificar corretor×imobiliária e
      // identificar os preferidos — segunda query por ids, mesmo padrão do
      // bloco `counts` logo abaixo (não depende de embed do PostgREST).
      const tIds = Array.from(
        new Set(pool.map((p) => p.tenant_id).filter((x): x is string => !!x)),
      );
      let tenantMeta: Record<string, TenantMeta | undefined> = {};
      if (tIds.length) {
        const { data: tm } = await supabase
          .from("tenants")
          .select("id,slug,tipo_tenant")
          .in("id", tIds);
        tenantMeta = Object.fromEntries(
          (tm ?? []).map((t: any) => [t.id, { slug: t.slug, tipo_tenant: t.tipo_tenant }]),
        );
      }
      setImoveis(comporDestaques(pool, tenantMeta, region, { limit: 8 }));

      const { data: ts } = await supabase
        .from("tenants")
        .select("id,slug,nome,tema,cidades_atuacao,regiao_atuacao")
        .in("status", ["active", "trial"])
        // imoB365 (Tenant 0) é a fornecedora da plataforma, não uma cliente —
        // não pode aparecer na vitrine de "Imobiliárias parceiras" ao lado
        // dos próprios clientes que usam o SaaS.
        .neq("slug", CORPORATE_TENANT_SLUG)
        // Vitrine de parceiros "premium" — só aparece quem o super_admin
        // liberou explicitamente em /admin/tenants ("Exibir na Home").
        .eq("exibir_na_home", true)
        .limit(12);
      const ids = (ts ?? []).map((t: any) => t.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: cs } = await supabase
          .from("imoveis")
          .select("tenant_id")
          .in("tenant_id", ids)
          .eq("publicado", true)
          .eq("status", "ativo");
        for (const r of cs ?? [])
          counts[(r as any).tenant_id] = (counts[(r as any).tenant_id] ?? 0) + 1;
      }
      setTenants(
        (ts ?? []).map((t: any) => ({
          id: t.id,
          slug: t.slug,
          nome: t.nome,
          total: counts[t.id] ?? 0,
          logoUrl: (t.tema as { logo_url?: string } | null)?.logo_url ?? null,
          cidadesAtuacao: t.cidades_atuacao ?? null,
          regiaoAtuacao: t.regiao_atuacao ?? null,
        })),
      );
      setTenantsLoaded(true);

      const { data: empData } = await (supabase as any)
        .from("empreendimentos")
        .select(
          "id,slug,nome,construtora,fase,endereco_cidade,endereco_uf,endereco_bairro,entrega_prevista,unidades_total,fotos_urls,descricao",
        )
        .eq("publicado", true)
        .order("created_at", { ascending: false })
        .limit(6);
      setEmpreendimentos((empData as EmpreendCard[]) ?? []);
    })();
  }, []);

  function publicUrl(path: string | null) {
    if (!path) return null;
    return imovelFotoUrl(path);
  }

  return (
    <div className="min-h-screen bg-background text-foreground animate-fade-in">
      <SiteHeader />

      {/* HERO + BUSCA */}
      <section className="relative isolate overflow-hidden border-b border-border/60 pb-20 pt-16 md:pb-28 md:pt-24 bg-cover bg-center">
        {/* Real city skyline background image centered and scaled like the image */}
        <div
          className="absolute inset-0 -z-30 bg-cover bg-center bg-no-repeat opacity-40 dark:opacity-10"
          style={{ backgroundImage: `url(${citySkylineHero})` }}
        />
        {/* Soft elegant vignette / gradient overlays to blend beautifully */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-background/95 via-background/65 to-transparent dark:from-background dark:via-background/80 dark:to-transparent" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--primary-glow)_15%,_transparent_55%)] opacity-35 dark:opacity-20" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-start text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-muted-foreground shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> A plataforma que conecta
              imobiliárias, corretores e clientes
            </span>
            {/* max-w removido em desktop (md:) — com max-w-4xl, as frases mais
                longas do texto rotativo abaixo estouravam pra uma 3ª linha e
                deslocavam o conteúdo seguinte da página. O container pai (
                max-w-6xl) já comporta a frase mais longa numa única linha
                (medido: ~1014px de texto em ~1104px disponíveis), então só
                era um limite artificial mais estreito que o espaço real —
                não precisou alargar nada além do que já existia. */}
            <h1 className="mt-8 max-w-4xl md:max-w-none text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tighter text-foreground min-h-[3.6em] sm:min-h-[2.8em]">
              Encontre o imóvel certo,
              <br />
              <span className="text-primary inline-block min-h-[1.26em] relative">
                {displayText}
                <span className="inline-block animate-pulse ml-1 select-none text-foreground font-light">
                  |
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground font-semibold leading-relaxed">
              Milhares de imóveis para comprar e alugar, ofertados por imobiliárias e corretores
              parceiros em todo o Brasil. Atendimento humano, sem burocracia.
            </p>
          </div>

          <div className="mt-12 w-full max-w-4xl rounded-3xl border border-border bg-white dark:bg-card p-4.5 shadow-md">
            <div className="flex gap-6 px-4 pb-2 border-b border-border/40">
              {(["venda", "aluguel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFinalidade(f)}
                  type="button"
                  className={`pb-2.5 text-sm font-bold transition-all relative ${
                    finalidade === f
                      ? "text-foreground font-extrabold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "venda" ? "Comprar" : "Alugar"}
                  {finalidade === f && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <form action="/buscar" method="get" className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-neutral-50/50 dark:bg-background px-4 py-2.5 shadow-2xs hover:border-primary/20 transition-all">
                  <MapPin className="h-5 w-5 text-muted-foreground/80 shrink-0" />
                  <Input
                    name="q"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Cidade, bairro ou referência (ex: Pinheiros, São Paulo)"
                    className="h-9 border-0 p-0 shadow-none focus-visible:ring-0 bg-transparent text-sm w-full font-medium placeholder:text-muted-foreground/60"
                  />
                </div>
                <input type="hidden" name="finalidade" value={finalidade} />
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-xl px-7 bg-primary hover:bg-[#d65e1b] hover:scale-101 text-white shadow-sm font-bold tracking-wide transition-all duration-200 shrink-0 h-12 flex items-center justify-center gap-2 pointer-events-auto"
                >
                  <Search className="h-4 w-4 stroke-[2.5px]" /> Buscar imóveis
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-primary group transition-all"
                aria-expanded={showAdvanced}
                aria-controls="busca-avancada"
              >
                <SlidersHorizontal className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span>Pesquisa avançada</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>

              {showAdvanced && (
                <div
                  id="busca-avancada"
                  className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                >
                  <Field label="Bairro">
                    <Input
                      name="bairro"
                      value={adv.bairro}
                      onChange={(e) => setAdv({ ...adv, bairro: e.target.value })}
                      placeholder="Ex: Moema"
                    />
                  </Field>
                  <Field label="Tipo de imóvel">
                    <select
                      name="tipo"
                      value={adv.tipo}
                      onChange={(e) => setAdv({ ...adv, tipo: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Qualquer</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="cobertura">Cobertura</option>
                      <option value="terreno">Terreno</option>
                      <option value="comercial">Comercial</option>
                      <option value="rural">Rural</option>
                    </select>
                  </Field>
                  <Field label="Quartos" icon={<Bed className="h-3.5 w-3.5" />}>
                    <select
                      name="quartos"
                      value={adv.quartos}
                      onChange={(e) => setAdv({ ...adv, quartos: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Qualquer</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                    </select>
                  </Field>
                  <Field label="Banheiros" icon={<Bath className="h-3.5 w-3.5" />}>
                    <select
                      name="banheiros"
                      value={adv.banheiros}
                      onChange={(e) => setAdv({ ...adv, banheiros: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Qualquer</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                    </select>
                  </Field>
                  <Field label="Vagas de garagem" icon={<Car className="h-3.5 w-3.5" />}>
                    <select
                      name="vagas"
                      value={adv.vagas}
                      onChange={(e) => setAdv({ ...adv, vagas: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Qualquer</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                    </select>
                  </Field>
                  <Field label="Área mín. (m²)" icon={<Maximize2 className="h-3.5 w-3.5" />}>
                    <Input
                      type="number"
                      name="areaMin"
                      value={adv.areaMin}
                      onChange={(e) => setAdv({ ...adv, areaMin: e.target.value })}
                      placeholder="Ex: 60"
                      min={0}
                    />
                  </Field>
                  <Field label="Valor mínimo (R$)">
                    <Input
                      type="number"
                      name="precoMin"
                      value={adv.precoMin}
                      onChange={(e) => setAdv({ ...adv, precoMin: e.target.value })}
                      placeholder="0"
                      min={0}
                    />
                  </Field>
                  <Field label="Valor máximo (R$)">
                    <Input
                      type="number"
                      name="precoMax"
                      value={adv.precoMax}
                      onChange={(e) => setAdv({ ...adv, precoMax: e.target.value })}
                      placeholder="Sem limite"
                      min={0}
                    />
                  </Field>

                  <div className="flex items-end gap-2 sm:col-span-2 md:col-span-3 lg:col-span-4">
                    <Button type="submit" className="flex-1 md:flex-none">
                      <Search className="mr-2 h-4 w-4" /> Aplicar filtros
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setAdv({
                          tipo: "",
                          quartos: "",
                          banheiros: "",
                          vagas: "",
                          precoMin: "",
                          precoMax: "",
                          areaMin: "",
                          bairro: "",
                        })
                      }
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="font-bold text-foreground tracking-tight">Procurando por:</span>
            {["Apartamento", "Casa", "Cobertura", "Comercial", "Terreno"].map((t) => (
              <Link
                key={t}
                to="/buscar"
                search={{ tipo: t.toLowerCase() }}
                className="rounded-full border border-border bg-white/95 dark:bg-card px-4.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <AssistenteIASection />

      {/* IMÓVEIS EM DESTAQUE */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Imóveis em destaque</h2>
            <p className="mt-2 text-muted-foreground">
              As melhores oportunidades publicadas pelas imobiliárias parceiras.
            </p>
          </div>
          <Link
            to="/buscar"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline md:inline-flex"
          >
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {imoveis.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          {imoveis.map((i) => {
            const url = publicUrl(i.capa);
            return (
              <Link
                key={i.id}
                to="/imovel/$slug"
                params={{ slug: i.slug ?? i.id }}
                className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {url ? (
                    <img
                      src={url}
                      alt={i.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow">
                    {FINALIDADE_LABEL[i.finalidade as keyof typeof FINALIDADE_LABEL] ??
                      i.finalidade}
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {TIPO_LABEL[i.tipo as keyof typeof TIPO_LABEL] ?? i.tipo}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                    {i.titulo}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[i.endereco_bairro, i.endereco_cidade, i.endereco_uf]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    {i.quartos != null && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-3 w-3" /> {i.quartos}
                      </span>
                    )}
                    {i.banheiros != null && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-3 w-3" /> {i.banheiros}
                      </span>
                    )}
                    {i.area_util != null && (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" /> {i.area_util} m²
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-lg font-bold text-foreground">
                    {i.preco != null ? formatBRL(Number(i.preco)) : "Sob consulta"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center md:hidden">
          <Link to="/buscar">
            <Button variant="outline">
              Ver todos os imóveis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* EMPREENDIMENTOS / LANÇAMENTOS */}
      {empreendimentos.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Empreendimentos e Lançamentos
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Conheça os novos empreendimentos das imobiliárias parceiras.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {empreendimentos.map((e) => {
                const foto = e.fotos_urls?.[0] ?? null;
                const FASE_LABEL: Record<string, string> = {
                  lancamento: "Lançamento",
                  em_obras: "Em obras",
                  pronto: "Pronto",
                  pre_lancamento: "Pré-lançamento",
                };
                const faseLabel = FASE_LABEL[e.fase] ?? e.fase;
                const faseColor =
                  e.fase === "lancamento"
                    ? "bg-emerald-500"
                    : e.fase === "pre_lancamento"
                      ? "bg-amber-500"
                      : e.fase === "em_obras"
                        ? "bg-blue-500"
                        : "bg-primary";
                return (
                  <Link
                    key={e.id}
                    to="/empreendimento/$slug"
                    params={{ slug: e.slug }}
                    className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      {foto ? (
                        <img
                          src={foto}
                          alt={e.nome}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Landmark className="h-10 w-10" />
                        </div>
                      )}
                      <span
                        className={`absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-semibold text-white shadow ${faseColor}`}
                      >
                        {faseLabel}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-1 text-sm font-semibold leading-snug">{e.nome}</h3>
                      {e.construtora && (
                        <p className="mt-0.5 text-xs text-muted-foreground">por {e.construtora}</p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[e.endereco_bairro, e.endereco_cidade, e.endereco_uf]
                          .filter(Boolean)
                          .join(", ") || "Localização a definir"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {e.unidades_total != null && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {e.unidades_total} unidades
                          </span>
                        )}
                        {e.entrega_prevista && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(e.entrega_prevista).toLocaleDateString("pt-BR", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      {e.descricao && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {e.descricao}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* IMOBILIÁRIAS PARCEIRAS */}
      <section id="parceiros" className="scroll-mt-20 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Corretores e Imobiliárias parceiras
              </h2>
              <p className="mt-2 text-muted-foreground">
                Trabalhamos lado a lado com quem entende do mercado local.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {!tenantsLoaded &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-xl border border-border bg-card"
                />
              ))}
            {tenants.map((t) => (
              <Link
                key={t.id}
                to="/site/$slug"
                params={{ slug: t.slug }}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {t.logoUrl ? (
                    <img
                      src={t.logoUrl}
                      alt={t.nome}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <Building className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold group-hover:text-primary">
                    {t.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.total} imóveis ativos</div>
                  {(t.cidadesAtuacao?.length || t.regiaoAtuacao) && (
                    <p
                      className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"
                      title={[...(t.cidadesAtuacao ?? []), t.regiaoAtuacao]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[...(t.cidadesAtuacao ?? []), t.regiaoAtuacao].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center md:flex md:items-center md:justify-between md:text-left">
            <div>
              <h3 className="text-lg font-semibold">
                Você ou sua imobiliária ainda não estão aqui?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre-se grátis e comece a divulgar seus imóveis em minutos.
              </p>
            </div>
            <Link to="/signup" className="mt-4 inline-block md:mt-0">
              <Button>Quero efetuar o cadastro agora!</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* COMO AJUDAMOS — valores */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          Como o imob365 trabalha por você
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Uma plataforma completa para captar, atender, fechar e administrar — do primeiro lead ao
          pós-venda, sem precisar de equipe de TI.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {valores.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MÓDULOS / RECURSOS — bento por jornada */}
      {/* Fundo: gradiente quente da marca (primary/15 → primary/5 → background)
          em vez do cinza bg-secondary/40 — calor visível no topo descendo pro
          fundo, destaca a seção sem competir com os cards; funciona em tema
          claro e escuro (tokens primary/background existem nos dois). */}
      <section
        id="recursos"
        className="border-t border-border bg-gradient-to-b from-primary/15 via-primary/5 to-background"
      >
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            Tudo o que sua imobiliária precisa, num só lugar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Organizado pela jornada do corretor — ative só o que precisa hoje e adicione novos
            recursos conforme cresce.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => (
              <div
                key={g.title}
                className="group rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <g.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold tracking-tight">{g.title}</h3>
                </div>
                <ul className="mt-5 space-y-4">
                  {g.items.map((it) => (
                    <li key={it.title} className="flex gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <it.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{it.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {it.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Pronto para vender e alugar mais, com menos esforço?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Teste grátis por 30 dias. Sem cartão de crédito.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground">
            Após os 30 dias, seus dados continuam salvos na plataforma — para seguir usando, basta
            escolher um plano de assinatura.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg">Começar agora</Button>
            </Link>
            <Link to="/planos">
              <Button size="lg" variant="outline">
                Ver planos e preços
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <>
      <ConstrutorasMarquee />
      <footer className="border-t border-border bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="space-y-4">
              <Logo className="h-9 w-auto" variant="white" />
              <p className="mt-4 text-sm opacity-80 leading-relaxed font-medium">
                A plataforma completa para quem vive de imóveis. Conectamos imobiliárias, corretores
                e clientes em todo o Brasil.
              </p>
              <div className="mt-5 flex gap-3">
                {[
                  { Icon: Facebook, href: "https://www.facebook.com/imob365/", label: "Facebook" },
                  {
                    Icon: Instagram,
                    href: "https://www.instagram.com/imob365/",
                    label: "Instagram",
                  },
                  {
                    Icon: Linkedin,
                    href: "https://www.linkedin.com/company/imob365/",
                    label: "LinkedIn",
                  },
                ].map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-primary hover:border-primary/50 hover:bg-white/10 transition-all duration-300 hover:scale-105"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <FooterCol
              title="Encontrar"
              links={[
                { label: "Comprar imóvel", to: "/buscar", icon: Building2 },
                { label: "Alugar imóvel", to: "/buscar", icon: Key },
                { label: "Imobiliárias parceiras", to: "/buscar", icon: Building },
                { label: "Lançamentos e novidades", to: "/buscar", icon: Sparkles },
              ]}
            />
            <FooterCol
              title="Para imobiliárias"
              links={[
                { label: "Planos e preços", to: "/planos", icon: CreditCard },
                { label: "Recursos da plataforma", to: "/plataforma", icon: SlidersHorizontal },
                { label: "Central de Ajuda", to: "/ajuda", icon: BookOpen },
                { label: "Anunciar imóvel", to: "/signup", icon: Building2 },
                { label: "Acessar plataforma", to: "/login", icon: Users },
                {
                  label: "Calculadoras (ITBI, financiamento)",
                  to: "/calculadoras",
                  icon: Calculator,
                  highlight: true,
                },
              ]}
            />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide opacity-90">
                Fale com a gente
              </h4>
              <ul className="mt-4 space-y-3.5 text-sm opacity-85">
                <li>
                  <Link
                    to="/atendimento"
                    className="flex items-center gap-3 hover:text-primary transition-all duration-200"
                  >
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10 shrink-0">
                      <Headset className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-semibold text-white/95">Central de Atendimento</span>
                  </Link>
                </li>
                <li className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                    <HeartHandshake className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <span>Suporte 365 dias por ano</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs opacity-70 md:flex-row md:items-center">
            <span>© {year} imob365. Todos os direitos reservados.</span>
            <div className="flex flex-wrap gap-5">
              <Link to="/termos" className="hover:text-primary transition-colors">
                Termos de uso
              </Link>
              <Link to="/privacidade" className="hover:text-primary transition-colors">
                Política de privacidade
              </Link>
              <Link to="/lgpd" className="hover:text-primary transition-colors">
                LGPD
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

interface FooterLink {
  label: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold uppercase tracking-wide opacity-90">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm opacity-85">
        {links.map((l) => {
          const Icon = l.icon;
          const content = (
            <span className="flex items-center gap-2 mb-0.5">
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 transition-all group-hover:scale-110 ${l.highlight ? "text-primary animate-pulse stroke-[2.25px]" : "opacity-60 group-hover:opacity-100 group-hover:text-white"}`}
                />
              )}
              <span
                className={
                  l.highlight
                    ? "text-primary font-bold tracking-wide relative"
                    : "hover:text-white transition-all"
                }
              >
                {l.label}
                {l.highlight && (
                  <span className="ml-1.5 inline-block text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded-full uppercase font-black tracking-widest leading-none scale-90">
                    ITBI
                  </span>
                )}
              </span>
            </span>
          );

          return (
            <li key={l.label}>
              {l.to.startsWith("/#") ? (
                <a
                  href={l.to}
                  className="group inline-flex items-center text-secondary-foreground hover:translate-x-1.5 transition-all duration-200"
                >
                  {content}
                </a>
              ) : (
                <Link
                  to={l.to}
                  className="group inline-flex items-center text-secondary-foreground hover:translate-x-1.5 transition-all duration-200"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const valores = [
  {
    icon: Sparkles,
    title: "Tecnologia simples",
    desc: "Cadastre imóveis, envie fotos e publique sem precisar de equipe de TI. Tudo num único lugar.",
  },
  {
    icon: HeartHandshake,
    title: "Atendimento que converte",
    desc: "Receba contatos interessados, organize seu funil e responda no WhatsApp sem perder oportunidade.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e conformidade",
    desc: "Dados protegidos, contratos digitais e conformidade com a LGPD — para você focar em vender imóveis.",
  },
];

// Bento por jornada do corretor. Regra de copy: nada de nome de
// concorrente/portal/terceiro na home — sempre genérico ("principais portais",
// "principais provedores"). Ver memória imob365_home_sem_nome_concorrente.
const grupos = [
  {
    icon: Radar,
    title: "Captação & Leads",
    items: [
      {
        icon: Radar,
        title: "Captação automática",
        desc: "Varre portais e marketplaces e traz imóveis novos direto pro seu funil, com importação manual assistida.",
      },
      {
        icon: Users,
        title: "Funil de leads",
        desc: "Kanban visual com leads de todos os canais num só lugar, do primeiro contato ao fechamento.",
      },
      {
        icon: Gauge,
        title: "Análise de risco",
        desc: "Score por CPF pra apresentar ao proprietário e decidir a locação com mais segurança.",
      },
      {
        icon: Briefcase,
        title: "Parceiros comerciais",
        desc: "CRM pra organizar o relacionamento com construtoras, incorporadoras e demais parceiros.",
      },
    ],
  },
  {
    icon: Headset,
    title: "Atendimento & Relacionamento",
    items: [
      {
        icon: Headset,
        title: "Central de Atendimento",
        desc: "Chamados organizados, com e-mail e WhatsApp usando suas próprias credenciais e controle de SLA.",
      },
      {
        icon: CreditCard,
        title: "Cartão virtual do corretor",
        desc: "Cartão de visita digital com QR, pronto pra compartilhar e captar novos contatos.",
      },
      {
        icon: RouteIcon,
        title: "Roteiro de visitas",
        desc: "Agenda e rota de visitas conectadas aos leads, sem planilha paralela.",
      },
      {
        icon: MessageCircle,
        title: "WhatsApp",
        desc: "Fale com o cliente em um clique, direto do imóvel ou do lead.",
      },
    ],
  },
  {
    icon: Globe2,
    title: "Marketing & Presença",
    items: [
      {
        icon: SlidersHorizontal,
        title: "Site próprio",
        desc: "Site profissional com seu domínio e sua identidade visual, pronto em minutos.",
      },
      {
        icon: BookOpen,
        title: "Blog com SEO",
        desc: "Publique conteúdo que atrai clientes pela busca do Google.",
      },
      {
        icon: QrCode,
        title: "Gerador de QR Code",
        desc: "QR codes pros seus imóveis e materiais, levando o offline pro online.",
      },
      {
        icon: Globe2,
        title: "Publicação em portais",
        desc: "Um anúncio publicado nos principais portais do mercado, tudo sincronizado automaticamente.",
      },
      {
        icon: Building,
        title: "Parcerias entre imobiliárias",
        desc: "Ganhe vitrine na home do imob365 e conecte-se a outras imobiliárias parceiras.",
      },
    ],
  },
  {
    icon: Scale,
    title: "Contratos & Jurídico",
    items: [
      {
        icon: Scale,
        title: "Ciclo de vida do contrato",
        desc: "Da minuta à ativação com garantias, checklist e etapas controladas, com rastreabilidade total.",
      },
      {
        icon: FileSignature,
        title: "Assinatura eletrônica",
        desc: "Integração com os principais provedores, usando a sua própria conta.",
      },
      {
        icon: Calendar,
        title: "Alertas de SLA",
        desc: "Avisos automáticos de cartório parado, garantias e contratos a vencer.",
      },
    ],
  },
  {
    icon: DollarSign,
    title: "Financeiro",
    items: [
      {
        icon: DollarSign,
        title: "Comissões e repasses",
        desc: "Comissões calculadas e repasses de locação ao proprietário, sem adivinhação.",
      },
      {
        icon: Wallet,
        title: "Inadimplência",
        desc: "Detecção automática de lançamentos vencidos e cobrança organizada.",
      },
      {
        icon: CreditCard,
        title: "Pagamentos online",
        desc: "Assinaturas e cobranças online integradas ao fluxo financeiro.",
      },
      {
        icon: Plug,
        title: "Conciliação & ERP",
        desc: "Conciliação bancária e integração com o seu ERP.",
      },
    ],
  },
  {
    icon: Sparkles,
    title: "Plataforma & IA",
    items: [
      {
        icon: Sparkles,
        title: "Assistente de IA",
        desc: "Pesquisa e ajuda especializada em mercado imobiliário, direto na plataforma.",
      },
      {
        icon: ShieldCheck,
        title: "Multi-tenant + LGPD",
        desc: "Isolamento total dos seus dados, LGPD nativa e auditoria de cada ação sensível.",
      },
      {
        icon: Plug,
        title: "API & webhooks",
        desc: "Conecte o imob365 ao que você já usa, sem depender de suporte manual.",
      },
      {
        icon: GraduationCap,
        title: "Treinamentos",
        desc: "Cursos e certificações pra deixar sua equipe mais preparada.",
      },
    ],
  },
];
