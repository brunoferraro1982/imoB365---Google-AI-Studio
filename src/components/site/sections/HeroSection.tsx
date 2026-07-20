import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LayoutKey } from "@/lib/siteSections";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";

type Stat = { icon: typeof Building2; label: string; value: string };

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
  };
  stats: Stat[];
}) {
  if (variant === "vitrine") {
    return (
      <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center md:py-20">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            Site oficial de {ctx.tenantNome}
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
            {hero.hero_titulo || ctx.tenantNome}
          </h1>
          {hero.hero_subtitulo && (
            <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{hero.hero_subtitulo}</p>
          )}
          <div className="mt-8 flex flex-col items-center gap-8">
            <a href="#imoveis">
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full px-8 shadow-lg shadow-black/10"
              >
                {hero.hero_cta_label || "Ver imóveis"}
              </Button>
            </a>
            {stats.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <s.icon className="h-5 w-5 opacity-80" />
                    <div className="text-left">
                      <div className="text-lg font-bold leading-tight">{s.value}</div>
                      <div className="text-xs opacity-75">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "boutique") {
    return (
      <section className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center md:py-32">
          <div className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {ctx.tenantNome}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {hero.hero_titulo || ctx.tenantNome}
          </h1>
          {hero.hero_subtitulo && (
            <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
              {hero.hero_subtitulo}
            </p>
          )}
          <div className="mt-9">
            <a href="#imoveis">
              <Button size="lg" variant="outline" className="rounded-none px-8">
                {hero.hero_cta_label || "Ver imóveis"}
              </Button>
            </a>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {ctx.tenantNome}
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            {hero.hero_titulo || ctx.tenantNome}
          </h1>
          {hero.hero_subtitulo && (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {hero.hero_subtitulo}
            </p>
          )}
          <div className="mt-8">
            <a href="#imoveis">
              <Button size="lg" className="rounded-md px-8">
                {hero.hero_cta_label || "Ver imóveis"}
              </Button>
            </a>
          </div>
        </div>
      </section>
    );
  }

  // classico (default) — visual atual, sem nenhuma mudança
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_22%,_transparent),_transparent_65%)]" />
      <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Site oficial de {ctx.tenantNome}
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          {hero.hero_titulo || ctx.tenantNome}
        </h1>
        {hero.hero_subtitulo && (
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {hero.hero_subtitulo}
          </p>
        )}
        <div className="mt-9">
          <a href="#imoveis">
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
              {hero.hero_cta_label || "Ver imóveis"}
            </Button>
          </a>
        </div>

        {stats.length > 0 && (
          <div className="mx-auto mt-16 flex max-w-2xl flex-wrap items-center justify-center gap-x-10 gap-y-6 border-t border-border/60 pt-10">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-xl font-bold leading-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
