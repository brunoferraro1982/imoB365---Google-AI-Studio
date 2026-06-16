import { SiteHeader } from "@/components/site-layout";
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
  Home,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Linkedin,
  SlidersHorizontal,
  ChevronDown,
  Car,
  Key,
  CreditCard,
  Calculator,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";

import citySkylineHero from "@/assets/images/city_skyline_hero_1780319947399.png";

export const Route = createFileRoute("/")({
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
};

type TenantCard = {
  id: string;
  slug: string;
  nome: string;
  total: number;
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
  const [tenants, setTenants] = useState<TenantCard[]>([]);
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
      const { data } = await supabase
        .from("imoveis")
        .select(
          "id,slug,titulo,finalidade,tipo,preco,quartos,banheiros,area_util,endereco_cidade,endereco_uf,endereco_bairro,imovel_fotos(storage_path,capa,ordem)",
        )
        .eq("publicado", true)
        .eq("status", "ativo")
        .order("updated_at", { ascending: false })
        .limit(8);
      const mapped: ImovelCard[] = (data ?? []).map((d: any) => {
        const fotos = (d.imovel_fotos ?? [])
          .slice()
          .sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
        return { ...d, capa: fotos[0]?.storage_path ?? null };
      });
      setImoveis(mapped);

      const { data: ts } = await supabase
        .from("tenants")
        .select("id,slug,nome")
        .in("status", ["active", "trial"])
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
        })),
      );
    })();
  }, []);

  // Auto-logout: mantém o usuário logado por apenas 5 minutos na home
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        async () => {
          await supabase.auth.signOut();
        },
        5 * 60 * 1000,
      );
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) schedule();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) schedule();
      else if (timer) clearTimeout(timer);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  function publicUrl(path: string | null) {
    if (!path) return null;
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
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
            <h1 className="mt-8 max-w-4xl text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tighter text-foreground min-h-[3.6em] sm:min-h-[2.8em]">
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

      {/* IMOBILIÁRIAS PARCEIRAS */}
      <section id="parceiros" className="scroll-mt-20 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Imobiliárias parceiras
              </h2>
              <p className="mt-2 text-muted-foreground">
                Trabalhamos lado a lado com quem entende do mercado local.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tenants.length === 0 &&
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
                  <Building className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold group-hover:text-primary">
                    {t.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.total} imóveis ativos</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center md:flex md:items-center md:justify-between md:text-left">
            <div>
              <h3 className="text-lg font-semibold">Sua imobiliária ainda não está aqui?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre-se grátis e comece a divulgar seus imóveis em minutos.
              </p>
            </div>
            <Link to="/signup" className="mt-4 inline-block md:mt-0">
              <Button>Quero cadastrar minha imobiliária</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* COMO AJUDAMOS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Como ajudamos a sua imobiliária
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Tecnologia simples de usar, pensada para quem vende e aluga imóveis no dia a dia — sem
          termos técnicos, sem complicação.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {servicos.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MÓDULOS / RECURSOS */}
      <section id="recursos" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tudo o que sua imobiliária precisa
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Ative apenas os recursos que você precisa hoje e adicione novos conforme cresce.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <div key={m.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <m.icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold">{m.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{m.desc}</p>
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
            Teste grátis por 14 dias. Sem cartão de crédito, sem fidelidade.
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
    <footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Logo className="h-9 w-auto" variant="white" />
            <p className="mt-4 text-sm opacity-80 leading-relaxed font-medium">
              A plataforma completa para quem vive de imóveis. Conectamos imobiliárias, corretores e
              clientes em todo o Brasil.
            </p>
            <div className="mt-5 flex gap-3">
              {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Rede social"
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
              { label: "Recursos da plataforma", to: "/#recursos", icon: SlidersHorizontal },
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
              <li className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <span>contato@imob365.com.br</span>
              </li>
              <li>
                <a
                  href="https://wa.me/5513997794382"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:text-primary transition-all duration-200"
                >
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10 shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <span>(13) 99779-4382</span>
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <HeartHandshake className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <span className="font-semibold text-white/95">Suporte 365 dias por ano</span>
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

const servicos = [
  {
    icon: Sparkles,
    title: "Tecnologia simples",
    desc: "Cadastre imóveis, envie fotos e publique nos principais portais sem precisar de equipe de TI. Tudo num único lugar.",
  },
  {
    icon: HeartHandshake,
    title: "Atendimento que converte",
    desc: "Receba contatos de clientes interessados, organize seu funil de vendas e responda no WhatsApp sem perder oportunidade.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e conformidade",
    desc: "Dados protegidos, contratos digitais e total conformidade com a LGPD — para você focar no que faz melhor: vender imóveis.",
  },
];

const modulos = [
  {
    icon: Building2,
    title: "Catálogo de imóveis",
    desc: "Cadastro completo com fotos, planta, vídeo e tour virtual.",
  },
  {
    icon: Users,
    title: "Clientes e oportunidades",
    desc: "Funil visual de vendas, distribuição automática e histórico de cada lead.",
  },
  {
    icon: Globe2,
    title: "Anúncios nos portais",
    desc: "Publique automaticamente no OLX, VivaReal, ZAP e Wimóveis com um clique.",
  },
  {
    icon: Home,
    title: "Gestão de locação",
    desc: "Contratos, repasses, vistorias e ordens de serviço para o setor de aluguel.",
  },
  {
    icon: Sparkles,
    title: "Inteligência artificial",
    desc: "Gere descrições de imóveis e mensagens personalizadas em segundos.",
  },
  {
    icon: ShieldCheck,
    title: "Contratos digitais",
    desc: "Modelos prontos, assinatura eletrônica e integração com cartórios.",
  },
];
