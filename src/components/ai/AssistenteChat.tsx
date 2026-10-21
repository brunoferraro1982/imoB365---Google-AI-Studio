import { useMemo, useState } from "react";
import { Sparkles, Send, Loader2, BadgeCheck, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { perguntarMercadoIA } from "@/lib/ai.functions";
import { buscarFaq, faqPorId, FAQ_SCORE_CONFIANTE, type FaqItem } from "@/content/faqMercado";

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
  const location = useLocation();
  const emBackend = location.pathname.startsWith("/app");
  // Fora do /app as perguntas são de mercado imobiliário: guia curado
  // instantâneo + IA rápida (Gemini). No /app segue o assistente do sistema
  // (base de conhecimento do produto e dados do tenant, via Ollama).
  if (!emBackend) return <AssistenteMercado compact={compact} />;
  return <AssistenteSistema compact={compact} />;
}

function AssistenteSistema({ compact = false }: { compact?: boolean }) {
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

// ─────────────────────────────────────────────────────────────────────────
// Assistente de mercado (portal público). Primeiro procura no guia curado
// (src/content/faqMercado.ts) — resposta instantânea, sem rede; só o que não
// está no guia vai para a IA (perguntarMercadoIA, Gemini Flash).

type RespostaMercado =
  | { tipo: "guia"; item: FaqItem; relacionados: FaqItem[] }
  | { tipo: "ia"; texto: string; relacionados: FaqItem[] };

function AssistenteMercado({ compact = false }: { compact?: boolean }) {
  const perguntarIA = useServerFn(perguntarMercadoIA);
  const [pergunta, setPergunta] = useState("");
  const [perguntaFeita, setPerguntaFeita] = useState("");
  const [resposta, setResposta] = useState<RespostaMercado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sugestões do guia enquanto a pessoa digita (instantâneo, local)
  const sugestoes = useMemo(
    () => (pergunta.trim().length >= 3 ? buscarFaq(pergunta, 3) : []),
    [pergunta],
  );

  async function perguntar(texto?: string) {
    const q = (texto ?? pergunta).trim();
    if (q.length < 3 || carregando) return;
    setPerguntaFeita(q);
    setPergunta("");
    setErro(null);

    const encontrados = buscarFaq(q, 3);
    const melhor = encontrados[0];
    if (melhor && melhor.score >= FAQ_SCORE_CONFIANTE) {
      setResposta({
        tipo: "guia",
        item: melhor.item,
        relacionados: encontrados.slice(1).map((r) => r.item),
      });
      return;
    }

    setResposta(null);
    setCarregando(true);
    try {
      const r = await perguntarIA({ data: { pergunta: q } });
      setResposta({
        tipo: "ia",
        texto: r.resposta,
        relacionados: r.relacionados.map(faqPorId).filter((f): f is FaqItem => !!f),
      });
    } catch (e) {
      setErro(
        e instanceof Error && /muitas perguntas/i.test(e.message)
          ? e.message
          : "Não consegui responder agora. Veja as perguntas frequentes ou fale com nosso atendimento.",
      );
    } finally {
      setCarregando(false);
    }
  }

  const abrirItem = (item: FaqItem) => {
    setPerguntaFeita(item.pergunta);
    setErro(null);
    setResposta({
      tipo: "guia",
      item,
      relacionados: buscarFaq(item.pergunta, 3)
        .map((r) => r.item)
        .filter((f) => f.id !== item.id)
        .slice(0, 2),
    });
  };

  return (
    <div className={compact ? "p-4" : "rounded-2xl border border-border bg-card p-6"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente de IA imoB365
        </div>
        <Link
          to="/perguntas-frequentes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
        >
          <BookOpen className="h-3.5 w-3.5" /> Todas as perguntas
        </Link>
      </div>

      {!resposta && !carregando && !erro && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXEMPLOS_MERCADO.map((ex) => (
            <button
              key={ex}
              onClick={() => perguntar(ex)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {(resposta || carregando || erro) && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
          {perguntaFeita && (
            <p className="mb-2 text-xs font-semibold text-muted-foreground">“{perguntaFeita}”</p>
          )}
          {carregando && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> A IA está preparando a resposta…
            </p>
          )}
          {erro && <p className="text-destructive">{erro}</p>}
          {resposta?.tipo === "guia" && (
            <>
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="h-3 w-3" /> Resposta verificada · Guia imoB365
              </span>
              <p className="font-semibold text-foreground">{resposta.item.pergunta}</p>
              <p className="mt-1 whitespace-pre-wrap">{resposta.item.resposta}</p>
              {resposta.item.links && resposta.item.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {resposta.item.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      {l.label} <ArrowRight className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
          {resposta?.tipo === "ia" && (
            <>
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Resposta gerada por IA
              </span>
              <p className="whitespace-pre-wrap">{resposta.texto}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Informação geral — para o seu caso, confirme com um especialista.
              </p>
            </>
          )}
          {resposta && resposta.relacionados.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Perguntas relacionadas
              </p>
              {resposta.relacionados.map((f) => (
                <button
                  key={f.id}
                  onClick={() => abrirItem(f)}
                  className="mt-1 block text-left text-xs font-medium text-primary hover:underline"
                >
                  {f.pergunta}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative mt-3">
        {sugestoes.length > 0 && !carregando && (
          <div className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Respostas instantâneas
            </p>
            {sugestoes.map((s) => (
              <button
                key={s.item.id}
                onClick={() => {
                  setPergunta("");
                  abrirItem(s.item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
              >
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                {s.item.pergunta}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void perguntar();
              }
            }}
            placeholder="Pergunte sobre financiamento, ITBI, aluguel, documentos..."
            className="min-h-10 resize-none text-sm"
            rows={1}
            maxLength={400}
            disabled={carregando}
          />
          <Button
            size="icon"
            onClick={() => void perguntar()}
            disabled={carregando || pergunta.trim().length < 3}
            aria-label="Perguntar"
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
