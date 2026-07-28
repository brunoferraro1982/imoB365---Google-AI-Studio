import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const PLANOS_ILIMITADOS = ["pro", "business"];

const EXEMPLOS_MERCADO = [
  "O que é ITBI?",
  "Como funciona o financiamento SAC?",
  "Quais documentos preciso pra financiar um imóvel?",
];

// Exemplos trocam pra "como usar o backend" quando o assistente é aberto
// dentro do /app — reforça visualmente que ele também ajuda com a própria
// ferramenta, não só com dúvidas de mercado imobiliário.
const EXEMPLOS_BACKEND = [
  "Como cadastro um imóvel?",
  "Como funciona o funil de leads?",
  "Como lanço uma comissão?",
];

// CLM Sprint 14 — dentro de um contrato específico, os exemplos priorizam
// perguntas sobre o próprio contrato (contexto RAG dedicado, ver
// buscarContextoContrato em aiAssistant.ts).
const EXEMPLOS_CONTRATO = [
  "Resuma este contrato",
  "Quais as condições de vigência deste contrato?",
  "Quem são as partes deste contrato?",
];

// CLM Sprint 14 — extrai o id do contrato direto da URL (mesma técnica já
// usada por nomeAmigavelDaPagina em aiAssistant.ts), sem precisar passar
// contratoId como prop através do FAB global (que vive fora da árvore de
// rotas com o param $id).
const CONTRATO_ID_REGEX = /^\/app\/contratos\/([0-9a-f-]{36})(?:$|\/)/i;

export function AssistenteChat({ compact = false }: { compact?: boolean }) {
  const { session, user, tenantId } = useAuth();
  const location = useLocation();
  const emBackend = location.pathname.startsWith("/app");
  const contratoId = location.pathname.match(CONTRATO_ID_REGEX)?.[1];
  const EXEMPLOS = contratoId ? EXEMPLOS_CONTRATO : emBackend ? EXEMPLOS_BACKEND : EXEMPLOS_MERCADO;
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ilimitado, setIlimitado] = useState<boolean | null>(null);

  async function checarPlano() {
    if (!tenantId) {
      setIlimitado(false);
      return;
    }
    const { data } = await supabase
      .from("tenants")
      .select("plano_slug")
      .eq("id", tenantId)
      .maybeSingle();
    setIlimitado(PLANOS_ILIMITADOS.includes((data as any)?.plano_slug ?? ""));
  }

  async function perguntar(texto?: string) {
    const q = (texto ?? pergunta).trim();
    if (!q || !session?.access_token) return;
    if (ilimitado === null) await checarPlano();

    setCarregando(true);
    setErro(null);
    setResposta("");
    try {
      const res = await fetch("/api/ai/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pergunta: q, pagina: location.pathname, contratoId }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setErro(msg || "Erro ao consultar o assistente.");
        setCarregando(false);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setResposta((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch {
      setErro("Não foi possível falar com o assistente agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  if (!user) {
    return (
      <div className={compact ? "p-4" : "rounded-2xl border border-border bg-card p-6"}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente de IA imoB365
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Pergunte sobre financiamento, ITBI, mudança e mercado imobiliário.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <span
              key={ex}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {ex}
            </span>
          ))}
        </div>
        <Link to="/login">
          <Button size="sm" className="mt-4 w-full">
            Faça login para perguntar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={compact ? "p-4" : "rounded-2xl border border-border bg-card p-6"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente de IA imoB365
        </div>
        {ilimitado && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Ilimitado
          </span>
        )}
      </div>

      {!resposta && !carregando && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setPergunta(ex);
                perguntar(ex);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {(resposta || carregando) && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {resposta}
          {carregando && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin" />}
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}

      <div className="mt-3 flex gap-2">
        <Textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              perguntar();
            }
          }}
          placeholder="Pergunte sobre imóveis, financiamento, ITBI..."
          className="min-h-10 resize-none text-sm"
          rows={1}
          disabled={carregando}
        />
        <Button size="icon" onClick={() => perguntar()} disabled={carregando || !pergunta.trim()}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {!ilimitado && ilimitado !== null && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          2 perguntas a cada 2 horas neste plano —{" "}
          <Link to="/planos" className="text-primary hover:underline">
            assine Pro ou Business
          </Link>{" "}
          pra acesso ilimitado.
        </p>
      )}
    </div>
  );
}
