import { Sparkles } from "lucide-react";
import { AssistenteChat } from "@/components/ai/AssistenteChat";
import { AvaliacaoImovelCard } from "@/components/portal/AvaliacaoImovelCard";

export function AssistenteIASection() {
  return (
    <section
      id="assistente-ia"
      className="scroll-mt-20 border-y border-border bg-gradient-to-br from-primary/5 via-background to-background"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <AvaliacaoImovelCard />

          <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 md:p-8">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Novo
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              Pergunte pra nossa IA sobre mercado imobiliário
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Financiamento, ITBI, mudança, documentação — tire dúvidas na hora, sem esperar
              atendimento.
            </p>
            <div className="mt-6 flex-1">
              <AssistenteChat compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
