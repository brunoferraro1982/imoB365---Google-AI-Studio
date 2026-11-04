import { BadgeCheck, MessageCircle } from "lucide-react";
import type { LayoutKey } from "@/lib/siteSections";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import { waHref } from "@/lib/tenantSite";
import { SecaoTitulo } from "./ui";

const PROSA =
  "prose prose-sm max-w-none text-foreground/85 dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6";

export function SobreSection({
  variant,
  ctx,
  sobre,
  compact,
}: {
  variant: LayoutKey;
  ctx: SiteCtx;
  sobre: string;
  /** Renderização estreita, para quando o bloco está numa área lateral (layout 'amplo'). */
  compact?: boolean;
}) {
  const isCorretor = ctx.tipoTenant === "corretor";
  const titulo = isCorretor ? `Sobre ${ctx.tenantNome.split(" ")[0]}` : "Sobre nós";

  if (compact) {
    return (
      <div className="glass-fosco rounded-3xl p-5">
        <SecaoTitulo compact titulo={titulo} />
        <article className={`${PROSA} -mt-4`} dangerouslySetInnerHTML={{ __html: sobre }} />
      </div>
    );
  }

  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  const retrato = isCorretor && ctx.logoUrl;

  return (
    <div
      className={`glass-fosco grid gap-8 overflow-hidden rounded-[32px] p-6 md:p-10 ${
        retrato ? "md:grid-cols-[280px_minmax(0,1fr)] md:items-center" : ""
      } ${variant === "boutique" ? "mx-auto max-w-4xl" : ""}`}
    >
      {retrato && (
        <div className="relative mx-auto w-full max-w-[280px]">
          <div className="absolute -inset-3 rounded-[32px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_35%,transparent),transparent)]" />
          <img
            src={ctx.logoUrl!}
            alt={ctx.tenantNome}
            className="relative aspect-[4/5] w-full rounded-[26px] object-cover shadow-xl ring-4 ring-white/80"
          />
          <span className="glass-fosco absolute -bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" />
            {ctx.creci ? `CRECI ${ctx.creci}` : "Corretor de imóveis"}
          </span>
        </div>
      )}
      <div className="min-w-0">
        <SecaoTitulo eyebrow={isCorretor ? "Quem sou" : "Quem somos"} titulo={titulo} />
        <article className={`${PROSA} -mt-3`} dangerouslySetInnerHTML={{ __html: sobre }} />
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />{" "}
            {isCorretor ? "Converse comigo" : "Fale com a gente"}
          </a>
        )}
      </div>
    </div>
  );
}
