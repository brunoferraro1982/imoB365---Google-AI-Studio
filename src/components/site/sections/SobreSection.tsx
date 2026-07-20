import { ShieldCheck } from "lucide-react";
import type { LayoutKey } from "@/lib/siteSections";

export function SobreSection({
  variant,
  sobre,
  compact,
}: {
  variant: LayoutKey;
  sobre: string;
  /** Renderização estreita, para quando o bloco está numa área lateral (layout 'amplo'). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-bold tracking-tight">Sobre nós</h2>
        <article
          className="prose prose-sm max-w-none text-sm [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: sobre }}
        />
      </div>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">Sobre nós</h2>
          <article
            className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: sobre }}
          />
        </div>
      </section>
    );
  }

  if (variant === "boutique") {
    return (
      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h2 className="mb-8 text-2xl font-bold tracking-tight">Sobre nós</h2>
          <article
            className="prose prose-sm mx-auto max-w-none text-left [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: sobre }}
          />
        </div>
      </section>
    );
  }

  // classico e vitrine — mesmo layout 2 colunas do design atual
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">Sobre nós</h2>
          <article
            className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: sobre }}
          />
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground">
          <ShieldCheck className="absolute -bottom-6 -right-6 h-32 w-32 opacity-15" />
          <p className="relative text-sm font-medium uppercase tracking-wider opacity-80">
            Compromisso
          </p>
          <p className="relative mt-3 text-xl font-bold leading-snug">
            Atendimento próximo, transparente e feito sob medida para você.
          </p>
        </div>
      </div>
    </section>
  );
}
