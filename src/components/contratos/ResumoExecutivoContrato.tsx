import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

const PERGUNTA_RESUMO =
  "Gere um resumo executivo curto (3-4 frases) deste contrato para o corretor, com base nos dados e cláusulas fornecidos.";

// CLM Sprint 14 — reaproveita 100% o mesmo endpoint/mecanismo do Assistente
// de IA (RAG + Ollama, /api/ai/assistente), só muda a pergunta fixa + o
// contratoId da URL. Nenhuma rota/infra nova. Sob demanda (botão), nunca
// automático — mesma disciplina anti-alucinação: o resumo só usa o
// CONTEXTO real do contrato (ver buscarContextoContrato em aiAssistant.ts),
// nunca inventa cláusula que não existe.
export function ResumoExecutivoContrato({ contratoId }: { contratoId: string }) {
  const { session } = useAuth();
  const [resumo, setResumo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    if (!session?.access_token) return;
    setCarregando(true);
    setErro(null);
    setResumo("");
    try {
      const res = await fetch("/api/ai/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pergunta: PERGUNTA_RESUMO,
          pagina: `/app/contratos/${contratoId}`,
          contratoId,
        }),
      });
      if (!res.ok) {
        setErro((await res.text()) || "Erro ao gerar resumo.");
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setResumo((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch {
      setErro("Não foi possível gerar o resumo agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <Sparkles className="h-4 w-4" /> Resumo executivo (IA)
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={gerar} disabled={carregando}>
          {carregando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {resumo ? "Gerar novamente" : "Gerar resumo"}
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Gerado sob demanda pelo Assistente de IA, com base apenas nos dados e cláusulas reais deste
        contrato.
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {resumo && <p className="whitespace-pre-wrap text-sm">{resumo}</p>}
    </section>
  );
}
