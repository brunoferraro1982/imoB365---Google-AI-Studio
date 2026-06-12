// site-layout.tsx — Componentes compartilhados de layout público
// Auto-extraído de index.tsx durante refatoração da home page

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
  ChevronRight,
  Car,
  Key,
  CreditCard,
  Calculator,
  Menu,
  X,
  Activity,
  Layers,
  Terminal,
  FileText,
  BookOpen,
  PlusCircle,
  Truck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
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

export function SiteHeader() {
  return <SiteHeaderImpl />;
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

function SiteHeaderImpl() {
  const { user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<
    "encontrar" | "ferramentas" | "imobiliarias" | "tecnico" | null
  >(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (menu: "encontrar" | "ferramentas" | "imobiliarias" | "tecnico") => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 220);
    setMenuTimeout(timeout);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md shadow-xs transition-all duration-300 font-sans">
      {/* BARRA SUPERIOR PRETA COM CONTATOS */}
      <div className="bg-neutral-950 text-white text-[11px] font-semibold py-2 px-6 border-b border-white/5">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Email / Telefone */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-5 text-white/80 w-full">
            <a
              href="mailto:contato@imob365.com.br"
              className="flex items-center gap-2 hover:text-primary transition-colors duration-200"
            >
              <Mail className="h-3.5 w-3.5 text-primary shrink-0 transition-transform hover:scale-110" />
              <span>contato@imob365.com.br</span>
            </a>
            <span className="hidden sm:inline text-white/20 select-none">|</span>
            <a
              href="https://wa.me/5513997794382"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary transition-colors duration-200"
            >
              <Phone className="h-3.5 w-3.5 text-primary shrink-0 transition-transform hover:scale-110" />
              <span>(13) 99779-4382</span>
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 relative">
        <Link to="/" className="flex items-center transition-transform hover:scale-[1.015]">
          <Logo className="h-9 w-auto" />
        </Link>

        {/* DESKTOP NAV WITH MEGA MENU POPUPS */}
        <nav className="hidden items-center gap-0.5 xl:gap-1.5 lg:flex text-[13px] xl:text-sm font-semibold text-foreground/85 tracking-tight xl:tracking-normal shrink-0">
          {/* LINK INICIAL */}
          <Link
            to="/"
            className="px-2 xl:px-3 py-2 rounded-lg hover:bg-muted/50 text-foreground/80 hover:text-foreground transition-colors duration-150 whitespace-nowrap"
          >
            Home
          </Link>

          {/* MEGA MENU 1: ENCONTRAR IMÓVEIS */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("encontrar")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeMenu === "encontrar"
                  ? "bg-muted text-primary"
                  : "hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>Encontrar Imóveis</span>
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${activeMenu === "encontrar" ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {activeMenu === "encontrar" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute left-1/2 -translate-x-[150px] top-full mt-2 w-[480px] rounded-2xl border border-border bg-background p-5 shadow-xl grid grid-cols-2 gap-4.5 z-50 overflow-hidden"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Disponíveis
                    </span>
                    <div className="space-y-1">
                      <Link
                        to="/buscar"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> Comprar Imóvel
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Apartamentos, coberturas e casas exclusivas.
                        </span>
                      </Link>

                      <Link
                        to="/buscar"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          <Key className="h-3.5 w-3.5" /> Alugar Imóvel
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Locação ágil, sem burocracia ou fiador tradicional.
                        </span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-l border-border/60 pl-4 space-y-3">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Inteligência
                    </span>
                    <div className="space-y-1">
                      <Link
                        to="/comparar"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-emerald-600" /> Comparador
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Compare até 4 imóveis lado a lado em tempo real.
                        </span>
                      </Link>

                      <Link
                        to="/buscar"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          <Search className="h-3.5 w-3.5 text-primary" /> Busca por Mapa
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Navegue pelas melhores regiões de forma geométrica.
                        </span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MEGA MENU 2: FERRAMENTAS & SIMULADORES */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("ferramentas")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeMenu === "ferramentas"
                  ? "bg-muted text-primary"
                  : "hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>Ferramentas & Simuladores</span>
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${activeMenu === "ferramentas" ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {activeMenu === "ferramentas" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[480px] rounded-2xl border border-border bg-background p-5 shadow-xl grid grid-cols-2 gap-4.5 z-50 overflow-hidden"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Simuladores
                    </span>
                    <div className="space-y-1">
                      <Link
                        to="/calculadora-financiamento"
                        className="flex flex-col p-2 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Calculator className="h-3.5 w-3.5 text-primary" /> Financiamento SAC
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Estime as parcelas decrescentes do imóvel de forma simples.
                        </span>
                      </Link>

                      <Link
                        to="/calculadora-itbi"
                        className="flex flex-col p-2 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Calculator className="h-3.5 w-3.5 text-orange-500" /> Imposto de ITBI
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Verifique taxas de prefeitura e cartório de registro.
                        </span>
                      </Link>

                      <Link
                        to="/calculadora-mudanca"
                        className="flex flex-col p-2 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-indigo-500" /> Custo de Mudança
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Planeje custos de frete e logística para o novo lar.
                        </span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-l border-border/60 pl-4 space-y-2">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Análise Cadastral
                    </span>

                    <div className="p-3 bg-muted/40 rounded-xl border border-border/65 space-y-1.5">
                      <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-sky-200">
                        Novo
                      </span>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-700" /> Score Serasa Experian
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Validação de CPF de inquilinos e proponentes integrados na hora da proposta
                        (/leads).
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MEGA MENU 3: PARA IMOBILIÁRIAS */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("imobiliarias")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeMenu === "imobiliarias"
                  ? "bg-muted text-primary"
                  : "hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>Para Imobiliárias</span>
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${activeMenu === "imobiliarias" ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {activeMenu === "imobiliarias" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-[120px] top-full mt-2 w-[290px] rounded-2xl border border-border bg-background p-4.5 shadow-xl flex flex-col gap-3.5 z-50 overflow-hidden"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Recursos de Negócio
                    </span>
                    <div className="space-y-1">
                      <Link
                        to="/planos"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 animate-pulse text-primary" /> Planos &
                          Valores
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Soluções ideais para corretores autônomos e agências de imóveis.
                        </span>
                      </Link>

                      <Link
                        to="/app/portais"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Globe2 className="h-3.5 w-3.5 text-emerald-600" /> Divulgação & Parcerias
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Anuncie automaticamente nos maiores portais de imóveis do país.
                        </span>
                      </Link>

                      <Link
                        to="/app/configuracoes/dominios"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-orange-500" /> Site com sua
                          Marca
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Crie um portal de imóveis exclusivo com as cores e logotipo da sua
                          empresa.
                        </span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MEGA MENU 4: ÁREA TÉCNICA */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("tecnico")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeMenu === "tecnico"
                  ? "bg-muted text-primary"
                  : "hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>Área Técnica</span>
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${activeMenu === "tecnico" ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {activeMenu === "tecnico" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-[280px] rounded-2xl border border-border bg-background p-4.5 shadow-xl flex flex-col gap-3.5 z-50 overflow-hidden"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
                      Recursos Integradores
                    </span>
                    <div className="space-y-1">
                      <Link
                        to="/app/configuracoes/golive"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" /> Painel Go-Live
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Auditoria e checklist completo de ativação do portal.
                        </span>
                      </Link>

                      <Link
                        to="/docs/api"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-emerald-600 group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5" /> Documentação API
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Disparadores REST e webhooks técnicos para ERPs de imobiliárias.
                        </span>
                      </Link>

                      <Link
                        to="/status"
                        className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
                      >
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-pink-600" /> Servidores & APIs
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          Verificação em tempo real da integridade de bancos de dados.
                        </span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="flex items-center gap-2.5">
          {/* HIGH VISIBILITY SEARCH CTA KEY FOR ANNOUNCEMENTS */}
          <Link
            to={user ? "/app/imoveis/novo" : "/signup"}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[#e86620] hover:from-[#e86620] hover:to-orange-500 text-white px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.02]"
          >
            <PlusCircle className="h-3.8 w-3.8 shrink-0" />
            <span>Anunciar Imóvel</span>
          </Link>

          {/* USER MENU & MOBILE BURGER */}
          <HeaderUserMenu />

          {/* MOBILE NAV BURGER */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="Menu de navegação"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[310px] sm:w-[370px] p-0 flex flex-col bg-background/95 backdrop-blur-md"
              >
                <SheetHeader className="px-6 py-5 border-b border-border/50">
                  <SheetTitle className="text-left font-bold tracking-tight text-foreground flex items-center justify-between">
                    <Logo className="h-8 w-auto" />
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 text-xs">
                  {/* MOBILE QUICK CTA FOR ANNOUNCE PROPERTY */}
                  <div className="px-3 pb-2">
                    <Link
                      to={user ? "/app/imoveis/novo" : "/signup"}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-[#e86620] px-4 py-3.5 text-xs font-black text-white shadow-sm hover:scale-[1.01] transition-all text-center"
                    >
                      <PlusCircle className="h-4.5 w-4.5 shrink-0" />
                      <span>Anunciar meu Imóvel</span>
                    </Link>
                  </div>

                  {/* Category 1 Mobile */}
                  <div className="space-y-1">
                    <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/85 mb-2.5">
                      Encontrar Imóveis
                    </h3>

                    <Link
                      to="/buscar"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Comprar Imóvel</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          As melhores residências e prédios
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/buscar"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <Key className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Alugar Imóvel</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Contratos ágeis e sem fiador
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/comparar"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-emerald-100/70 text-emerald-800 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Comparador de Imóveis</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Lado a lado em tempo real
                        </span>
                      </div>
                    </Link>
                  </div>

                  {/* Category 2 Mobile */}
                  <div className="space-y-1">
                    <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/85 mb-2.5">
                      Simuladores e Cálculos
                    </h3>

                    <Link
                      to="/calculadora-financiamento"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Calculator className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Financiamento SAC</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Parcelas decrescentes de financiamento
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/calculadora-itbi"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-orange-100 text-orange-700 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <Calculator className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Simulador de ITBI</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Custos de transferência e impostos
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/calculadora-mudanca"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Custo de Mudança</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Previsão logística e fretes
                        </span>
                      </div>
                    </Link>
                  </div>

                  {/* Category 3 Mobile */}
                  <div className="space-y-1">
                    <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/85 mb-2.5">
                      Para Imobiliárias & Corretores
                    </h3>

                    <Link
                      to="/planos"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Planos e Preços</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Opções para corretores e agências
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/app/portais"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Globe2 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Divulgação & Parcerias</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Anunciar em múltiplos portais
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/app/configuracoes/dominios"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
                    >
                      <div className="p-2 bg-orange-100 text-orange-850 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>Site com sua Marca</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Layout personalizado e logotipo próprio
                        </span>
                      </div>
                    </Link>
                  </div>

                  {/* Category 4 Devs Mobile */}
                  <div className="space-y-1 border-t border-border/50 pt-3">
                    <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/85 mb-2">
                      Área Técnica (Devs)
                    </h3>

                    <Link
                      to="/app/configuracoes/golive"
                      className="flex items-center gap-3.5 px-3 py-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      <span>Painel Go-Live (Checklist)</span>
                    </Link>
                    <Link
                      to="/docs/api"
                      className="flex items-center gap-3.5 px-3 py-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
                    >
                      <Terminal className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Documentação de API</span>
                    </Link>
                    <Link
                      to="/status"
                      className="flex items-center gap-3.5 px-3 py-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
                    >
                      <Activity className="h-4 w-4 shrink-0 text-pink-600" />
                      <span>Servidores & APIs (Status)</span>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
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
