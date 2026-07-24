/**
 * Assistente de IA — botão flutuante visível em toda rota (pública e
 * autenticada), diferente do WhatsAppFAB que só aparece no portal público.
 * O acesso Pro/Business ilimitado só faz sentido logado, então esconder
 * em /app quebraria o próprio requisito do produto.
 */
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { AssistenteChat } from "@/components/ai/AssistenteChat";

export function AssistenteIAFAB() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {aberto && (
        <div className="fixed bottom-40 right-6 z-50 w-[min(360px,calc(100vw-3rem))] rounded-2xl border border-border bg-card shadow-xl">
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
        className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-black/20 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/40"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </button>
    </>
  );
}
