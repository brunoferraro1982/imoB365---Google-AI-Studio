/**
 * Assistente de IA — botão flutuante visível em toda rota (pública e
 * autenticada), diferente do AtendimentoFAB que só aparece no portal público.
 * O acesso Pro/Business ilimitado só faz sentido logado, então esconder
 * em /app quebraria o próprio requisito do produto.
 *
 * Oculto em /buscar: a página já tem seu próprio widget "Conversar com IA"
 * (busca conversacional por filtros, Sprint 6) no mesmo canto — dois botões
 * de IA sobrepostos ali confundem mais do que ajudam.
 */
import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { AssistenteChat } from "@/components/ai/AssistenteChat";

export function AssistenteIAFAB() {
  const [aberto, setAberto] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith("/buscar")) {
    return null;
  }

  return (
    <>
      {aberto && (
        <div className="bottom-safe-40 fixed right-6 z-40 w-[min(360px,calc(100vw-3rem))] rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Assistente de IA</span>
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar assistente"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AssistenteChat compact />
        </div>
      )}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Assistente de IA"
        className="bottom-safe-24 fixed right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-black/20 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/40"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </button>
    </>
  );
}
