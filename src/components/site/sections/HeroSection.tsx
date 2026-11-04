import { ArrowRight, BadgeCheck, Building2, MessageCircle } from "lucide-react";
import type { LayoutKey } from "@/lib/siteSections";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import { waHref } from "@/lib/tenantSite";
import { FormLeadSite } from "./ui";

type Stat = { icon: typeof Building2; label: string; value: string };

/** Boutique e Editorial usam o hero claro; os demais, o hero escuro. */
export function heroClaro(variant: LayoutKey) {
  return variant === "boutique" || variant === "editorial";
}

// Retrato do corretor autônomo (tema.logo_url tratado como foto de perfil)
// ou logo da imobiliária, com selo de profissão + CRECI.
function Identidade({ ctx, claro }: { ctx: SiteCtx; claro: boolean }) {
  const isCorretor = ctx.tipoTenant === "corretor";
  const selo = isCorretor ? "Corretor de imóveis" : "Imobiliária";
  return (
    <div className="mb-6 flex items-center gap-4">
      {ctx.logoUrl &&
        (isCorretor ? (
          <img
            src={ctx.logoUrl}
            alt={ctx.tenantNome}
            className={`h-20 w-20 shrink-0 rounded-full object-cover shadow-xl md:h-24 md:w-24 ${
              claro ? "ring-4 ring-white" : "ring-4 ring-white/20"
            }`}
          />
        ) : (
          <span
            className={`grid h-16 shrink-0 place-items-center rounded-2xl px-4 ${claro ? "glass-fosco" : "bg-white/95"}`}
          >
            <img
              src={ctx.logoUrl}
              alt={ctx.tenantNome}
              className="h-10 max-w-[140px] object-contain"
            />
          </span>
        ))}
      <div className="min-w-0">
        <p
          className={`font-brand-display truncate text-lg font-extrabold ${claro ? "text-foreground" : "text-white"}`}
        >
          {ctx.tenantNome}
        </p>
        <span
          className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            claro ? "glass-fosco text-foreground/80" : "glass-escuro text-white/85"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          {selo}
          {ctx.creci ? ` · CRECI ${ctx.creci}` : ""}
        </span>
      </div>
    </div>
  );
}

export function HeroSection({
  variant,
  ctx,
  hero,
  stats,
}: {
  variant: LayoutKey;
  ctx: SiteCtx;
  hero: {
    hero_titulo?: string | null;
    hero_subtitulo?: string | null;
    hero_cta_label?: string | null;
    hero_imagem_url?: string | null;
    hero_formulario?: boolean | null;
  };
  stats: Stat[];
}) {
  const claro = heroClaro(variant);
  const comForm = hero.hero_formulario !== false;
  const foto = hero.hero_imagem_url || null;
  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  const titulo = hero.hero_titulo || ctx.tenantNome;

  const fundo = claro ? (
    <>
      {foto && (
        <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/70 to-white/40 dark:from-[#0b1220]/90 dark:via-[#0b1220]/75 dark:to-[#0b1220]/50" />
      <div className="site-mesh absolute inset-0" />
    </>
  ) : (
    <>
      <div className="site-hero-fundo absolute inset-0" />
      {foto && (
        <>
          <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="site-hero-veu absolute inset-0" />
        </>
      )}
    </>
  );

  return (
    <section className={`relative overflow-hidden ${claro ? "text-foreground" : "text-white"}`}>
      {fundo}
      <div
        className={`relative mx-auto grid max-w-6xl items-center gap-10 px-4 md:px-6 ${
          variant === "boutique" ? "py-20 md:py-28" : "py-14 md:py-20"
        } ${comForm ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}`}
      >
        <div className={comForm ? "" : "max-w-3xl"}>
          <Identidade ctx={ctx} claro={claro} />
          <h1
            className={`font-brand-display font-extrabold tracking-tight ${
              variant === "boutique"
                ? "text-[2.1rem] leading-[1.1] md:text-5xl"
                : "text-[2.25rem] leading-[1.05] md:text-[3.4rem]"
            }`}
          >
            {titulo}
          </h1>
          {hero.hero_subtitulo && (
            <p
              className={`mt-5 max-w-xl text-base leading-relaxed md:text-lg ${claro ? "text-muted-foreground" : "text-white/75"}`}
            >
              {hero.hero_subtitulo}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#imoveis"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_12px_28px_-12px_color-mix(in_oklab,var(--primary)_85%,transparent)] transition hover:opacity-90"
            >
              {hero.hero_cta_label || "Ver imóveis"} <ArrowRight className="h-4 w-4" />
            </a>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                  claro ? "glass-fosco hover:bg-white" : "glass-escuro hover:bg-white/15"
                }`}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
          {stats.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:flex sm:flex-wrap sm:gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className={`flex flex-col items-start gap-2 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 ${claro ? "glass-fosco" : "glass-escuro"}`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/90 text-primary-foreground">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="text-left">
                    <span className="font-brand-display block text-xl font-extrabold leading-none">
                      {s.value}
                    </span>
                    <span
                      className={`text-xs ${claro ? "text-muted-foreground" : "text-white/65"}`}
                    >
                      {s.label}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {comForm && (
          <div className="w-full lg:max-w-md lg:justify-self-end">
            <FormLeadSite ctx={ctx} escuro={!claro} />
          </div>
        )}
      </div>
    </section>
  );
}
