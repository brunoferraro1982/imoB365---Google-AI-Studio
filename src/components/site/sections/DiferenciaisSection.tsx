import { ArrowRight, MessageCircle } from "lucide-react";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import {
  COMO_FUNCIONA_PADRAO,
  DIFERENCIAIS_PADRAO,
  itensOuPadrao,
  type Diferencial,
  type Passo,
} from "@/lib/siteSections";
import { waHref } from "@/lib/tenantSite";
import { SecaoTitulo, iconeSite } from "./ui";

export function DiferenciaisSection({ ctx, compact }: { ctx: SiteCtx; compact?: boolean }) {
  const itens = itensOuPadrao<Diferencial>(ctx.settings.diferenciais, DIFERENCIAIS_PADRAO);
  return (
    <div className="@container">
      <SecaoTitulo
        compact={compact}
        eyebrow={ctx.tipoTenant === "corretor" ? "Por que comigo" : "Por que nós"}
        titulo={
          ctx.tipoTenant === "corretor" ? "Atendimento que faz diferença" : "Nossos diferenciais"
        }
      />
      <div className={`grid gap-4 ${compact ? "" : "@2xl:grid-cols-3"}`}>
        {itens.map((d) => {
          const Icone = iconeSite(d.icone);
          return (
            <div key={d.titulo} className="glass-fosco rounded-3xl p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)]">
                <Icone className="h-5 w-5" />
              </span>
              <h3 className="font-brand-display mt-4 text-lg font-extrabold leading-snug">
                {d.titulo}
              </h3>
              {d.texto && (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.texto}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComoFuncionaSection({
  ctx,
  compact,
  alvoForm,
}: {
  ctx: SiteCtx;
  compact?: boolean;
  /** id do formulário de lead para o CTA "Quero receber opções". */
  alvoForm: string;
}) {
  const passos = itensOuPadrao<Passo>(ctx.settings.como_funciona, COMO_FUNCIONA_PADRAO);
  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);

  if (compact)
    return (
      <div>
        <SecaoTitulo compact eyebrow="Como funciona" titulo="Passo a passo" />
        <ol className="space-y-3">
          {passos.map((p, i) => (
            <li key={p.titulo} className="glass-fosco rounded-2xl p-4">
              <p className="text-sm font-bold">
                {i + 1}. {p.titulo}
              </p>
              {p.texto && <p className="mt-1 text-xs text-muted-foreground">{p.texto}</p>}
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <div className="site-hero-fundo relative overflow-hidden rounded-[32px] px-5 py-12 text-white md:px-10 md:py-14">
      <SecaoTitulo
        claro
        eyebrow="Como funciona"
        titulo={`${passos.length} passos até a sua chave`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {passos.map((p, i) => (
          <div key={p.titulo} className="glass-escuro rounded-3xl p-6">
            <span className="font-brand-display grid h-10 w-10 place-items-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
              {i + 1}
            </span>
            <h3 className="font-brand-display mt-4 text-lg font-extrabold">{p.titulo}</h3>
            {p.texto && <p className="mt-1.5 text-sm leading-relaxed text-white/70">{p.texto}</p>}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={`#${alvoForm}`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          Quero receber opções <ArrowRight className="h-4 w-4" />
        </a>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-escuro inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:bg-white/15"
          >
            <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
