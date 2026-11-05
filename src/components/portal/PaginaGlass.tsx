import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

// Peças do padrão Liquid Glass das páginas institucionais (/contato,
// /a-imob365, /consultoria, /atendimento, /blog, /ajuda, /docs/api,
// /status, /planos, /plataforma): topo em vidro, faixa de etapas, blocos com
// fundo alternado (branco predominante / cinza-claro), cartão e selo.

export const BLOCO_BRANCO = "relative scroll-mt-24 bg-white px-4 py-10 md:py-12 dark:bg-[#0b1220]";
export const BLOCO_CINZA =
  "relative scroll-mt-24 bg-gradient-to-b from-[#f3f4f6] to-[#eef0f3] px-4 py-10 md:py-12 dark:from-[#0f172a] dark:to-[#0f172a]";
export const CARD_GLASS =
  "rounded-3xl border border-black/5 bg-white/80 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5";
export const SELO =
  "inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-wide text-primary";
export const TITULO_SECAO = "font-brand-display text-2xl font-extrabold tracking-tight sm:text-3xl";

/** Wrapper da página: fundo branco e tipografia do brand system. */
export function PaginaGlass({ children }: { children: ReactNode }) {
  return <div className="hero-brand min-h-screen bg-white dark:bg-[#0b1220]">{children}</div>;
}

export type EtapaChip = { icon: LucideIcon; titulo: string };

/** Etapas em linha (chips com seta), usadas no topo das páginas. */
export function FaixaEtapas({ etapas, rotulo }: { etapas: EtapaChip[]; rotulo: string }) {
  return (
    <ol
      className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 pt-1"
      aria-label={rotulo}
    >
      {etapas.map((e, i) => (
        <li key={e.titulo} className="flex items-center gap-1.5">
          <span className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm dark:border-white/10 dark:bg-white/10">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
              <e.icon className="h-3.5 w-3.5" />
            </span>
            {e.titulo}
          </span>
          {i < etapas.length - 1 && <ArrowRight className="h-4 w-4 text-primary/70" />}
        </li>
      ))}
    </ol>
  );
}

/**
 * Topo em cartão de vidro de largura total: selo (mantido em caixa alta,
 * como "breadcrumb"), título com destaque laranja, subtítulo e conteúdo
 * extra (faixa de etapas, busca, atalhos…).
 */
export function HeroGlass({
  selo,
  seloIcon: SeloIcon,
  titulo,
  destaque,
  subtitulo,
  children,
}: {
  selo: string;
  seloIcon?: LucideIcon;
  titulo: string;
  destaque?: string;
  subtitulo?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-8 pt-8 md:pt-10 dark:bg-[#0b1220]">
      <div aria-hidden className="mesh-brand-claro pointer-events-none absolute inset-0" />
      <div className="glass-fosco relative mx-auto max-w-6xl space-y-5 rounded-[28px] px-6 py-9 text-center md:px-10 md:py-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
          {SeloIcon && <SeloIcon className="h-3.5 w-3.5" />} {selo}
        </span>
        <h1 className="font-brand-display text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {titulo}
          {destaque && (
            <>
              {" "}
              <span className="text-primary">{destaque}</span>
            </>
          )}
        </h1>
        {subtitulo && (
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitulo}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/** Atalhos (âncoras) logo abaixo do topo. */
export function Atalhos({ itens }: { itens: { id: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 pt-1">
      {itens.map((a) => (
        <a
          key={a.id}
          href={`#${a.id}`}
          className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
        >
          {a.label}
        </a>
      ))}
    </div>
  );
}

/** "Primeira letra maiúscula, demais minúsculas" (títulos vindos do banco). */
export function fraseCase(t: string) {
  const baixo = t.toLocaleLowerCase("pt-BR");
  return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
}
