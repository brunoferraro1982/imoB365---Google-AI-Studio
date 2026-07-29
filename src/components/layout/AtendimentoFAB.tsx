/**
 * Central de Atendimento — botão flutuante do portal público, substitui o
 * antigo WhatsAppFAB (número fixo da imoB365, sem rastreio). Abre um mini
 * formulário que cria um chamado real via public_create_chamado — o
 * WhatsApp continua existindo como canal de entrada (Sprint 5), mas a
 * operação passa a ser sempre pela Central, nunca um wa.me solto sem
 * histórico.
 */
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Headset, X } from "lucide-react";
import { AtendimentoWidget } from "@/components/atendimento/AtendimentoWidget";

export function AtendimentoFAB() {
  const [aberto, setAberto] = useState(false);
  const location = useLocation();

  if (location.pathname.startsWith("/app") || location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      {aberto && (
        // bottom-40 (não bottom-24) — o botão do Assistente de IA ocupa
        // bottom-24/right-6 nesta mesma página; um painel mais baixo
        // sobreporia esse botão.
        <div className="fixed bottom-40 right-6 z-50 w-[min(340px,calc(100vw-3rem))] rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Central de Atendimento</span>
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AtendimentoWidget compact />
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link to="/atendimento" className="text-xs text-primary hover:underline">
              Ver central completa
            </Link>
          </div>
        </div>
      )}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Central de Atendimento"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-black/20 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/40"
      >
        <Headset className="h-6 w-6 text-primary-foreground" />
      </button>
    </>
  );
}
