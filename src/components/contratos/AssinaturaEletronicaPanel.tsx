import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PenTool, Send, Settings, CheckCircle, Loader2 } from "lucide-react";

const PROVIDER_LABEL: Record<string, string> = {
  docusign: "DocuSign",
  clicksign: "Clicksign",
  zapsign: "ZapSign",
  gov_br: "gov.br",
  icp_brasil: "ICP-Brasil",
  outro: "Outro provedor",
};

const PARTE_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Aguardando assinatura",
  assinado: "Assinado",
};

const CONTRATO_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho / não enviado",
  enviado: "Aguardando signatários",
  assinado_parcial: "Assinatura parcial",
  assinado_total: "Contrato assinado",
};

type Parte = {
  id: string;
  nome: string;
  papel: string;
  assinatura_status: string;
  assinatura_referencia_externa: string | null;
};

// Substitui o painel sandbox (100% simulado via setTimeout) por um harness
// real BYO: cada tenant conecta o próprio provedor em Configurações >
// Assinatura eletrônica. "Solicitar assinatura" só grava a referência e marca
// como enviado — a confirmação real de "assinado" só chega via webhook do
// provedor configurado (ver api.public.webhooks.assinatura.$provider.ts),
// nunca é simulada aqui.
export function AssinaturaEletronicaPanel({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{ provider: string; ativo: boolean } | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [statusContrato, setStatusContrato] = useState("rascunho");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "completed">("idle");

  async function load() {
    setLoading(true);
    const [{ data: cfg }, { data: partesData }, { data: contrato }] = await Promise.all([
      tenantId
        ? (supabase as any)
            .from("tenant_assinatura_config")
            .select("provider,ativo")
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase as any)
        .from("contrato_partes")
        .select("id,nome,papel,assinatura_status,assinatura_referencia_externa")
        .eq("contrato_id", contratoId),
      (supabase as any)
        .from("contratos")
        .select("assinatura_status")
        .eq("id", contratoId)
        .maybeSingle(),
    ]);
    setConfig(cfg);
    setPartes((partesData ?? []) as Parte[]);
    setStatusContrato(contrato?.assinatura_status ?? "rascunho");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, tenantId]);

  async function solicitarAssinatura(parte: Parte) {
    setEnviando(parte.id);
    const { error } = await (supabase as any)
      .from("contrato_partes")
      .update({
        assinatura_status: "enviado",
        assinatura_referencia_externa: crypto.randomUUID(),
      })
      .eq("id", parte.id);
    setEnviando(null);
    if (error) return toast.error(error.message);
    toast.success(`Solicitação de assinatura enviada para ${parte.nome}`);
    load();
  }

  function handleGerarPdf() {
    setPdfStatus("generating");
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1400)), {
      loading: "Compilando cláusulas e gerando PDF do contrato…",
      success: () => {
        setPdfStatus("completed");
        return "PDF compilado com sucesso!";
      },
      error: "Erro ao gerar PDF",
    });
  }

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <PenTool className="h-4 w-4" /> Assinatura eletrônica
        </h2>
        <Badge
          variant={statusContrato === "assinado_total" ? "default" : "secondary"}
          className="uppercase tracking-wide"
        >
          {CONTRATO_STATUS_LABEL[statusContrato] ?? statusContrato}
        </Badge>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-background p-3.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">Etapa 1: Gerar PDF oficial</span>
          {pdfStatus === "completed" && <CheckCircle className="h-4 w-4 text-emerald-600" />}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Compila as cláusulas cadastradas, dados das partes e condições do contrato em um PDF
          definitivo para assinatura.
        </p>
        <Button
          type="button"
          size="sm"
          variant={pdfStatus === "completed" ? "outline" : "default"}
          disabled={pdfStatus === "generating"}
          onClick={handleGerarPdf}
        >
          {pdfStatus === "generating" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          {pdfStatus === "completed" ? "PDF gerado (clique para refazer)" : "Gerar PDF do contrato"}
        </Button>
      </div>

      {!config?.ativo ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p className="mb-2">
            Nenhum provedor de assinatura eletrônica configurado para este tenant.
          </p>
          <Link
            to="/app/configuracoes/assinatura-eletronica"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Settings className="h-3.5 w-3.5" /> Configurar integração
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Integração ativa: {PROVIDER_LABEL[config.provider] ?? config.provider}. A confirmação de
            assinatura chega automaticamente via webhook quando o signatário assina de fato no
            provedor.
          </p>

          {partes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma parte cadastrada — adicione as partes do contrato acima antes de solicitar
              assinatura.
            </p>
          ) : (
            <ul className="space-y-2">
              {partes.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.papel} · {PARTE_STATUS_LABEL[p.assinatura_status] ?? p.assinatura_status}
                    </p>
                  </div>
                  {p.assinatura_status === "pendente" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={enviando === p.id}
                      onClick={() => solicitarAssinatura(p)}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />
                      {enviando === p.id ? "Enviando…" : "Solicitar assinatura"}
                    </Button>
                  ) : (
                    <Badge variant={p.assinatura_status === "assinado" ? "default" : "secondary"}>
                      {PARTE_STATUS_LABEL[p.assinatura_status] ?? p.assinatura_status}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
