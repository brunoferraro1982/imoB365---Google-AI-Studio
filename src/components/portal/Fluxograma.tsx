import { CheckCircle2, type LucideIcon } from "lucide-react";

export type Etapa = { icon: LucideIcon; titulo: string; texto: string };

/**
 * Fluxograma ilustrado (cartão escuro de vidro): etapas numeradas ligadas
 * por setas até o resultado. Usado em /consultoria e /atendimento.
 */
export function Fluxograma({
  titulo,
  etapas,
  resultado,
  legenda = "Fluxo do serviço",
}: {
  titulo: string;
  etapas: Etapa[];
  resultado: string;
  legenda?: string;
}) {
  return (
    <figure
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1e3a] via-[#14274a] to-[#1b2f57] p-5 text-white"
      aria-label={`Fluxograma: ${titulo}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl"
      />
      <figcaption className="relative mb-4 flex items-center justify-between text-[11px] font-semibold text-white/60">
        <span>{legenda}</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5">
          {etapas.length} etapas
        </span>
      </figcaption>
      <ol className="relative grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
        {etapas.map((e, i) => (
          <li key={e.titulo} className="relative flex flex-col items-center text-center">
            {i < etapas.length - 1 && (
              <svg
                aria-hidden
                viewBox="0 0 24 12"
                className="absolute left-[calc(50%+24px)] top-[14px] hidden h-3 w-[calc(100%-36px)] text-white/35 sm:block"
                preserveAspectRatio="none"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path d="M0 6h21M17 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-md shadow-primary/30">
              <e.icon className="h-4 w-4" />
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-black text-[#0f1e3a]">
                {i + 1}
              </span>
            </span>
            <span className="mt-2 text-[12px] font-bold leading-tight">{e.titulo}</span>
            {e.texto && (
              <span className="mt-0.5 text-[10.5px] leading-snug text-white/60">{e.texto}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/15 px-3.5 py-2.5 text-center text-sm font-bold text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {resultado}
      </div>
    </figure>
  );
}
