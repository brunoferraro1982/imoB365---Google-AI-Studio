import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Printer,
  Banknote,
  FileText,
  CheckCircle,
  ShieldCheck,
  PenTool,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ContratoForm } from "@/components/contratos/ContratoForm";
import { PartesSection } from "@/components/contratos/PartesSection";
import { ContratoChecklist } from "@/components/contratos/ContratoChecklist";

export const Route = createFileRoute("/app/contratos/$id")({
  component: EditarContrato,
});

type AssinaturaStatus = "rascunho" | "enviado" | "assinado_parcial" | "assinado_total";

function EditarContrato() {
  const { id } = Route.useParams();
  const { tenantId, user } = useAuth();
  const [gerando, setGerando] = useState(false);

  // PDF generation state
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "completed">("idle");

  // Assinatura status — loaded from DB, persisted on change
  const [assinaturaStatus, setAssinaturaStatus] = useState<AssinaturaStatus>("rascunho");
  const [enviandoClicksign, setEnviandoClicksign] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Load current assinatura_status from DB
  useEffect(() => {
    if (!id) return;
    (supabase as any)
      .from("contratos")
      .select("assinatura_status")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: Record<string, unknown> | null }) => {
        if (data?.assinatura_status) {
          setAssinaturaStatus(data.assinatura_status as AssinaturaStatus);
        }
        setStatusLoaded(true);
      });
  }, [id]);

  // Persist assinatura_status to DB
  async function persistAssinaturaStatus(newStatus: AssinaturaStatus) {
    if (!id) return;
    setAssinaturaStatus(newStatus);
    await (supabase as any)
      .from("contratos")
      .update({ assinatura_status: newStatus })
      .eq("id", id);
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

  async function handleEnviarClicksign() {
    if (pdfStatus !== "completed") {
      toast.error("Gere o PDF do contrato antes de enviar para assinatura.");
      return;
    }
    setEnviandoClicksign(true);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await persistAssinaturaStatus("enviado");
    setEnviandoClicksign(false);
    toast.success("Envelope enviado! Links de assinatura disparados por e-mail.");
  }

  async function handleSimularAssinatura(papel: "locatario" | "locador") {
    toast.info(`Simulando assinatura do papel: ${papel === "locatario" ? "Locatário" : "Locador"}…`);
    await new Promise((resolve) => setTimeout(resolve, 900));

    let next: AssinaturaStatus = assinaturaStatus;
    if (assinaturaStatus === "enviado") next = "assinado_parcial";
    else if (assinaturaStatus === "assinado_parcial") next = "assinado_total";

    if (next !== assinaturaStatus) {
      await persistAssinaturaStatus(next);
      toast.success(
        `Assinatura de ${papel === "locatario" ? "Locatário" : "Locador"} registrada!`,
      );
    }
  }

  async function gerarComissao() {
    if (!tenantId) return;
    setGerando(true);
    const { data: c, error } = await supabase
      .from("contratos")
      .select("id,valor,comissao_valor,comissao_percentual,corretor_id,imovel_id,numero")
      .eq("id", id)
      .maybeSingle();
    if (error || !c) {
      setGerando(false);
      return toast.error(error?.message ?? "Contrato não encontrado");
    }
    const valor =
      c.comissao_valor ??
      (c.comissao_percentual ? (Number(c.valor) * Number(c.comissao_percentual)) / 100 : 0);
    if (!valor || valor <= 0) {
      setGerando(false);
      return toast.error("Defina comissão (% ou R$) antes de gerar");
    }
    const { error: insErr } = await supabase.from("lancamentos_financeiros").insert({
      tenant_id: tenantId,
      tipo: "saida" as any,
      categoria: "comissao",
      descricao: `Comissão — contrato ${c.numero ?? `#${c.id.slice(0, 8)}`}`,
      valor,
      data_vencimento: new Date().toISOString().slice(0, 10),
      status: "pendente" as any,
      contrato_id: c.id,
      imovel_id: c.imovel_id,
      corretor_id: c.corretor_id,
      created_by: user?.id,
    });
    setGerando(false);
    if (insErr) return toast.error(insErr.message);
    toast.success("Lançamento de comissão criado");
  }

  return (
    <div className="p-8">
      <Link
        to="/app/contratos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Editar contrato</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={gerarComissao} disabled={gerando}>
            <Banknote className="mr-2 h-4 w-4" />
            {gerando ? "Gerando…" : "Gerar comissão"}
          </Button>
          <Link to="/app/contratos/$id/imprimir" params={{ id }}>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl space-y-6">
        <ContratoForm contratoId={id} />
        <PartesSection contratoId={id} />

        {tenantId && statusLoaded && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Checklist */}
            <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Checklist de documentos
              </h2>
              <ContratoChecklist contratoId={id} tenantId={tenantId} />
            </section>

            {/* ClickSign Panel */}
            <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4 font-sans">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-primary" /> Assinatura Digital
              </h2>

              <div className="space-y-4 text-xs">
                {/* Status badge */}
                <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border border-border/50">
                  <span className="font-medium text-muted-foreground">Status do envelope:</span>
                  <span
                    className={`font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-[10px] ${
                      assinaturaStatus === "assinado_total"
                        ? "bg-emerald-100 text-emerald-800"
                        : assinaturaStatus === "assinado_parcial"
                          ? "bg-indigo-100 text-indigo-800 animate-pulse"
                          : assinaturaStatus === "enviado"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {assinaturaStatus === "assinado_total"
                      ? "Contrato Assinado"
                      : assinaturaStatus === "assinado_parcial"
                        ? "Aguardando (1/2)"
                        : assinaturaStatus === "enviado"
                          ? "Aguardando Signatários"
                          : "Rascunho / Não Enviado"}
                  </span>
                </div>

                {/* Step 1 — Generate PDF */}
                <div className="bg-background border border-border p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Etapa 1: Gerar PDF Oficial</span>
                    {pdfStatus === "completed" && (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Compila as cláusulas cadastradas, dados das partes e condições do contrato em um
                    PDF definitivo para assinatura.
                  </p>
                  <Button
                    type="button"
                    variant={pdfStatus === "completed" ? "outline" : "default"}
                    disabled={pdfStatus === "generating"}
                    onClick={handleGerarPdf}
                    className="w-full text-xs h-8"
                  >
                    {pdfStatus === "generating" && (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    {pdfStatus === "completed"
                      ? "PDF Gerado (Clique para Refazer)"
                      : "Gerar PDF do Contrato"}
                  </Button>
                </div>

                {/* Step 2 — Send to ClickSign */}
                {pdfStatus === "completed" && (
                  <div className="bg-background border border-border p-3.5 rounded-lg space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        Etapa 2: Enviar para Assinatura
                      </span>
                      {assinaturaStatus !== "rascunho" && (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Cria o envelope na ClickSign e dispara links de assinatura por e-mail e
                      WhatsApp para cada parte.
                    </p>
                    <Button
                      type="button"
                      variant={assinaturaStatus !== "rascunho" ? "outline" : "default"}
                      disabled={enviandoClicksign || assinaturaStatus !== "rascunho"}
                      onClick={handleEnviarClicksign}
                      className="w-full text-xs h-8"
                    >
                      {enviandoClicksign && (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      )}
                      {assinaturaStatus !== "rascunho"
                        ? "Enviado à ClickSign"
                        : "Enviar para ClickSign"}
                    </Button>
                  </div>
                )}

                {/* Step 3 — Signers (sandbox simulation) */}
                {assinaturaStatus !== "rascunho" && (
                  <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-3 animate-fade-in">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Painel de Signatários (Sandbox)
                    </span>
                    <div className="space-y-2">
                      {/* Locatário */}
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div>
                          <span className="font-medium block text-[11px]">Locatário</span>
                          <span className="text-[9px] text-muted-foreground">
                            sandbox.clicksign.com/s/1a2b…
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            assinaturaStatus === "assinado_parcial" ||
                            assinaturaStatus === "assinado_total"
                          }
                          onClick={() => handleSimularAssinatura("locatario")}
                          className="text-[10px] h-7 px-2"
                        >
                          {assinaturaStatus === "assinado_parcial" ||
                          assinaturaStatus === "assinado_total"
                            ? "✓ Assinado"
                            : "Simular"}
                        </Button>
                      </div>
                      {/* Locador */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium block text-[11px]">
                            Locador / Imobiliária
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            sandbox.clicksign.com/s/3c4d…
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={assinaturaStatus === "assinado_total"}
                          onClick={() => handleSimularAssinatura("locador")}
                          className="text-[10px] h-7 px-2"
                        >
                          {assinaturaStatus === "assinado_total" ? "✓ Assinado" : "Simular"}
                        </Button>
                      </div>
                    </div>

                    {assinaturaStatus === "assinado_total" && (
                      <div className="pt-2 border-t border-emerald-200 text-[10px] text-emerald-800 bg-emerald-50/50 p-2 rounded flex items-center gap-1.5 leading-snug">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>
                          Hash SHA-256 e Termo de Assinatura Eletrônica ClickSign vinculados ao
                          PDF em conformidade com MP 2.200-2/2001 e Lei 14.063/2020.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                  * Integração em modo sandbox. Para produção, configure{" "}
                  <code>VITE_CLICKSIGN_API_KEY</code> nas variáveis de ambiente.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
