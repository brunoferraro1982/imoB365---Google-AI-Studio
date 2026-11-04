import { useEffect, useState } from "react";
import {
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  ArrowUpRight,
  Menu,
  BadgeCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { waHref as montarWaHref } from "@/lib/tenantSite";

export type SiteCtx = {
  tenantId: string;
  tenantSlug: string;
  tenantNome: string;
  logoUrl?: string | null;
  /** 'corretor' | 'imobiliaria' | null — quando 'corretor', a mesma imagem
   * de tema.logo_url é tratada como foto pessoal (retrato na hero), não
   * como logo de empresa (não aparece como ícone no header/rodapé). */
  tipoTenant?: string | null;
  /** CRECI exibido no selo do hero e no rodapé (pessoal ou jurídico). */
  creci?: string | null;
  settings: {
    contato_telefone?: string | null;
    contato_whatsapp?: string | null;
    contato_email?: string | null;
    endereco?: string | null;
    instagram_url?: string | null;
    facebook_url?: string | null;
    youtube_url?: string | null;
    linkedin_url?: string | null;
    cor_destaque?: string | null;
    meta_description?: string | null;
    hero_titulo?: string | null;
    hero_subtitulo?: string | null;
    hero_cta_label?: string | null;
    hero_imagem_url?: string | null;
    hero_formulario?: boolean | null;
    sobre_html?: string | null;
    diferenciais?: unknown;
    como_funciona?: unknown;
  };
  pages: { slug: string; titulo: string }[];
  hasBlog?: boolean;
  hasSobre?: boolean;
  empreendimentosTotal?: number;
};

type NavItem = { key: string; label: string; to: string; hash?: string };

function navItems(ctx: SiteCtx): NavItem[] {
  const base = `/site/${ctx.tenantSlug}`;
  return [
    { key: "inicio", label: "Início", to: base },
    { key: "imoveis", label: "Imóveis", to: `${base}/imoveis` },
    ...((ctx.empreendimentosTotal ?? 0) > 0
      ? [{ key: "lancamentos", label: "Lançamentos", to: `${base}/lancamentos` }]
      : []),
    ...(ctx.hasSobre ? [{ key: "sobre", label: "Sobre", to: base, hash: "sobre" }] : []),
    ...ctx.pages.map((p) => ({
      key: `page-${p.slug}`,
      label: p.titulo,
      to: `${base}/p/${p.slug}`,
    })),
    ...(ctx.hasBlog ? [{ key: "blog", label: "Blog", to: `${base}/blog` }] : []),
    { key: "contato", label: "Contato", to: base, hash: "contato" },
  ];
}

export function SiteMarca({ ctx, claro }: { ctx: SiteCtx; claro?: boolean }) {
  const isCorretor = ctx.tipoTenant === "corretor";
  if (ctx.logoUrl && !isCorretor)
    return (
      <img src={ctx.logoUrl} alt={ctx.tenantNome} className="h-9 max-w-[170px] object-contain" />
    );
  return (
    <span className="flex items-center gap-2.5">
      {isCorretor && ctx.logoUrl ? (
        <img
          src={ctx.logoUrl}
          alt=""
          className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70 shadow-sm"
        />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground shadow-sm">
          {ctx.tenantNome.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span
          className={`font-brand-display text-[15px] font-extrabold tracking-tight ${claro ? "text-white" : "text-foreground"}`}
        >
          {ctx.tenantNome}
        </span>
        {isCorretor && (
          <span className={`text-[11px] ${claro ? "text-white/60" : "text-muted-foreground"}`}>
            Corretor de imóveis{ctx.creci ? ` · CRECI ${ctx.creci}` : ""}
          </span>
        )}
      </span>
    </span>
  );
}

function SiteHeader({ ctx }: { ctx: SiteCtx }) {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const wa = montarWaHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  const itens = navItems(ctx);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {/* O vidro fica numa camada irmã: se o backdrop-filter ficasse no
          próprio header, ele viraria "backdrop root" e o Sheet/menus
          filhos não desfocariam o conteúdo de trás. */}
      <div
        aria-hidden
        className={`absolute inset-0 border-b transition-all duration-300 ${
          rolou
            ? "border-black/5 bg-white/70 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/10 dark:bg-[#0b1220]/70"
            : "border-transparent bg-white/40 backdrop-blur-xl backdrop-saturate-[1.6] dark:bg-[#0b1220]/40"
        }`}
      />
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link
          to="/site/$slug"
          params={{ slug: ctx.tenantSlug }}
          className="flex min-w-0 shrink-0 items-center"
        >
          <SiteMarca ctx={ctx} />
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-black/5 bg-white/50 p-1 text-[13.5px] font-semibold text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/5 lg:flex">
          {itens.map((i) => (
            <Link
              key={i.key}
              to={i.to}
              hash={i.hash}
              activeOptions={{ exact: true, includeHash: false }}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors hover:bg-white hover:text-foreground dark:hover:bg-white/10"
            >
              {i.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition hover:opacity-90 sm:inline-flex"
            >
              <MessageCircle className="h-4 w-4" />
              Fale comigo
            </a>
          )}
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu"
                className="grid h-10 w-10 place-items-center rounded-full border border-black/5 bg-white/60 text-foreground shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] border-l border-white/40 bg-white/80 p-0 backdrop-blur-2xl dark:bg-[#0b1220]/85"
            >
              <SheetHeader className="border-b border-black/5 p-5 text-left dark:border-white/10">
                <SheetTitle asChild>
                  <div>
                    <SiteMarca ctx={ctx} />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-3">
                {itens.map((i) => (
                  <Link
                    key={i.key}
                    to={i.to}
                    hash={i.hash}
                    onClick={() => setAberto(false)}
                    className="rounded-xl px-4 py-3 text-[15px] font-semibold text-foreground/85 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {i.label}
                  </Link>
                ))}
              </nav>
              {wa && (
                <div className="px-5">
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                  </a>
                </div>
              )}
              <Link
                to="/"
                className="mt-6 block px-5 text-xs text-muted-foreground hover:text-foreground"
              >
                Site criado com imoB365 ↗
              </Link>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const REDES = [
  { k: "instagram_url", label: "Instagram", icon: Instagram },
  { k: "facebook_url", label: "Facebook", icon: Facebook },
  { k: "youtube_url", label: "YouTube", icon: Youtube },
  { k: "linkedin_url", label: "LinkedIn", icon: Linkedin },
] as const;

function SiteFooter({ ctx }: { ctx: SiteCtx }) {
  const wa = montarWaHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  const redes = REDES.filter((r) => ctx.settings[r.k]);
  const s = ctx.settings;

  return (
    <footer className="site-hero-fundo relative mt-10 overflow-hidden text-zinc-300">
      {wa && (
        <div className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
          <div className="glass-escuro flex flex-col items-start justify-between gap-5 rounded-[28px] p-6 md:flex-row md:items-center md:p-8">
            <div>
              <p className="font-brand-display text-xl font-extrabold text-white md:text-2xl">
                Encontrou o imóvel ideal?
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Fale agora com {ctx.tenantNome} pelo WhatsApp — resposta rápida.
              </p>
            </div>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> Iniciar conversa
            </a>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6">
        <div className="glass-escuro rounded-3xl p-6">
          <SiteMarca ctx={ctx} claro />
          {ctx.creci && ctx.tipoTenant !== "corretor" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
              <BadgeCheck className="h-4 w-4 text-primary" /> CRECI {ctx.creci}
            </p>
          )}
          {s.endereco && (
            <p className="mt-4 flex items-start gap-2 text-sm text-zinc-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {s.endereco}
            </p>
          )}
        </div>
        <div className="glass-escuro rounded-3xl p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Contato</h3>
          <ul className="space-y-3 text-sm">
            {s.contato_telefone && (
              <li>
                <a
                  href={`tel:${s.contato_telefone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Phone className="h-4 w-4 text-primary" /> {s.contato_telefone}
                </a>
              </li>
            )}
            {s.contato_email && (
              <li>
                <a
                  href={`mailto:${s.contato_email}`}
                  className="flex items-center gap-2 break-all hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" /> {s.contato_email}
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
        <div className="glass-escuro rounded-3xl p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            {redes.length ? "Redes sociais" : "Navegue"}
          </h3>
          {redes.length ? (
            <div className="flex flex-wrap gap-2.5">
              {redes.map((r) => (
                <a
                  key={r.k}
                  href={s[r.k] as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={r.label}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.08] text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:border-transparent hover:bg-primary hover:text-primary-foreground"
                >
                  <r.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {navItems(ctx)
                .slice(0, 5)
                .map((i) => (
                  <li key={i.key}>
                    <Link to={i.to} hash={i.hash} className="hover:text-white">
                      {i.label}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-zinc-500 sm:flex-row md:px-6">
          <span>
            © {new Date().getFullYear()} {ctx.tenantNome}
            {ctx.creci ? ` · CRECI ${ctx.creci}` : ""}
          </span>
          <Link to="/" className="inline-flex items-center gap-1 hover:text-white">
            Site criado com <span className="font-semibold text-zinc-400">imoB365</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function TenantSiteLayout({ ctx, children }: { ctx: SiteCtx; children: React.ReactNode }) {
  const cor = ctx.settings.cor_destaque || undefined;
  return (
    <div
      className="hero-brand relative min-h-screen bg-[#f6f7f9] text-foreground dark:bg-[#0b1220]"
      style={
        cor
          ? ({ "--site-accent": cor, "--primary": cor, "--ring": cor } as React.CSSProperties)
          : undefined
      }
    >
      <div aria-hidden className="site-mesh pointer-events-none fixed inset-0 -z-0" />
      <SiteHeader ctx={ctx} />
      <main className="relative">{children}</main>
      <SiteFooter ctx={ctx} />
    </div>
  );
}

/** Esqueleto de carregamento no mesmo visual (substitui o "Carregando…"). */
export function SiteSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-[#0b1220]">
      <div className="h-16 border-b border-black/5 bg-white/60" />
      <div className="site-hero-fundo h-[520px] animate-pulse" />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-white/70" />
        ))}
      </div>
    </div>
  );
}
