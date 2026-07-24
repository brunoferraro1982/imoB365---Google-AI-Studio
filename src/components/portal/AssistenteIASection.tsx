import { Sparkles } from "lucide-react";
import { AssistenteChat } from "@/components/ai/AssistenteChat";

export function AssistenteIASection() {
  return (
    <section
      id="assistente-ia"
      className="scroll-mt-20 border-y border-border bg-gradient-to-br from-primary/5 via-background to-background"
    >
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Novo
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Pergunte pra nossa IA sobre mercado imobiliário
        </h2>
        <p className="mt-3 text-muted-foreground">
          Financiamento, ITBI, mudança, documentação — tire dúvidas na hora, sem esperar
          atendimento.
        </p>
        <div className="mx-auto mt-8 max-w-xl text-left">
          <AssistenteChat />
        </div>
      </div>
    </section>
  );
}
