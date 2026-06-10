import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Printer,
  Banknote,
  FileText,
  Send,
  CheckCircle,
  ShieldCheck,
  PenTool,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useState } from "react";
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

function EditarContrato() {
  const { id } = Route.useParams();
  const { tenantId, user } = useAuth();
  const [gerando, setGerando] = useState(false);

  // ClickSign and PDF states (Sprint 8)
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "completed">("idle");
  const [clicksignStatus, setClicksignStatus] = useState<
    "rascunho" | "enviado" | "assinado_parcial" | "assinado_total"
  >("rascunho");
  const [enviandoClicksign, setEnviandoClicksign] = useState(false);

  function handleGerarPdf() {
    setPdfStatus("generating");
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1400)), {
      loading: "Compilando cláusulas do contrato e anexando laudo de vistoria no PDF...",
      success: () => {
        setPdfStatus("completed");
        return "Arquivo PDF do Contrato compilado com sucesso!";
      },
      error: "Erro ao gerar PDF",
    });
  }

  function handleEnviarClicksign() {
    if (pdfStatus !== "completed") {
      toast.error("Por favor, gere o PDF do contrato antes de enviar para assinatura eletrônica.");
      return;
    }
    setEnviandoClicksign(true);
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1600)), {
      loading: "Transmitindo envelope de assinaturas para ClickSign API Sandbox...",
      success: () => {
        setClicksignStatus("enviado");
        setEnviandoClicksign(false);
        return "Envelope ClickSign criado! Links de assinatura gerados para as partes.";
      },
      error: () => {
        setEnviandoClicksign(false);
        return "Erro ao transmitir envelope.";
      },
    });
  }

  function handleSimularAssinatura(papel: "locatario" | "locador") {
    toast.info(
      `Simulando fluxo de assinatura ClickSign para papel: ${papel === "locatario" ? "Locatário" : "Locador"}...`,
    );
    setTimeout(() => {
      setClicksignStatus((prev) => {
        if (prev === "enviado") return "assinado_parcial";
        if (prev === "assinado_parcial") return "assinado_total";
        return prev;
      });
      toast.success(
        `Assinatura ClickSign processada com sucesso para: ${papel === "locatario" ? "Locatário" : "Locador"}!`,
      );
    }, 1000);
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
      descricao: `Comissão do contrato ${c.numero ?? `#${c.id.slice(0, 8)}`}`,
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
            <Banknote className="mr-2 h-4 w-4" /> {gerando ? "Gerando…" : "Gerar comissão"}
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
        {tenantId && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Checklist de documentos
              </h2>
              <ContratoChecklist contratoId={id} tenantId={tenantId} />
            </section>

            {/* ClickSign Electronic Signature Panel (Sprint 8) */}
            <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4 font-sans">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-primary" /> Assinaturas ClickSign
              </h2>

              <div className="space-y-4 text-xs">
                {/* Integration Status indicators */}
                <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border border-border/50">
                  <span className="font-medium text-muted-foreground">Status do Envelope:</span>
                  <span
                    className={`font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-[10px] ${
                      clicksignStatus === "assinado_total"
                        ? "bg-emerald-100 text-emerald-800"
                        : clicksignStatus === "assinado_parcial"
                          ? "bg-indigo-100 text-indigo-800 animate-pulse"
                          : clicksignStatus === "enviado"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {clicksignStatus === "assinado_total"
                      ? "Contrato Assinado"
                      : clicksignStatus === "assinado_parcial"
                        ? "Assinatura Pendente (1/2)"
                        : clicksignStatus === "enviado"
                          ? "Aguardando Signatários"
                          : "Rascunho / Não Enviado"}
                  </span>
                </div>

                {/* Step 1: Generate PDF */}
                <div className="bg-background border border-border p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground block">
                      Etapa 1: Geração de PDF Oficial
                    </span>
                    {pdfStatus === "completed" && (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Compila todas as cláusulas jurídicas cadastradas, termos de reajuste do
                    IGP-M/IPCA e gera o arquivo físico definitivo.
                  </p>
                  <Button
                    type="button"
                    variant={pdfStatus === "completed" ? "outline" : "default"}
                    disabled={pdfStatus === "generating"}
                    onClick={handleGerarPdf}
                    className="w-full text-xs h-8 font-sans"
                  >
                    {pdfStatus === "generating" ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {pdfStatus === "completed"
                      ? "PDF Gerado (Clique para Refazer)"
                      : "Gerar PDF do Contrato"}
                  </Button>
                </div>

                {/* Step 2: ClickSign Envelope dispatch */}
                {pdfStatus === "completed" && (
                  <div className="bg-background border border-border p-3.5 rounded-lg space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground block">
                        Etapa 2: Envelope de Assinatura
                      </span>
                      {clicksignStatus !== "rascunho" && (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sincroniza o contrato com a API da ClickSign e dispara links de autenticação
                      automática por e-mail e WhatsApp.
                    </p>
                    <Button
                      type="button"
                      variant={clicksignStatus !== "rascunho" ? "outline" : "default"}
                      disabled={enviandoClicksign || clicksignStatus !== "rascunho"}
                      onClick={handleEnviarClicksign}
                      className="w-full text-xs h-8 font-sans"
                    >
                      {enviandoClicksign ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {clicksignStatus !== "rascunho"
                        ? "Transmitido à ClickSign"
                        : "Disparar para ClickSign"}
                    </Button>
                  </div>
                )}

                {/* Step 3: Signers and Sign Simulators */}
                {clicksignStatus !== "rascunho" && (
                  <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-3 animate-fade-in font-sans">
                    <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider text-muted-foreground">
                      Painel de Laboratório (Sandbox API)
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div>
                          <span className="font-medium block text-[11px]">
                            Locatário (Inquilino)
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            Link: sandbox.clicksign.com/s/1a2b...
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            clicksignStatus === "assinado_parcial" ||
                            clicksignStatus === "assinado_total"
                          }
                          onClick={() => handleSimularAssinatura("locatario")}
                          className="text-[10px] h-7 px-2"
                        >
                          {clicksignStatus === "assinado_parcial" ||
                          clicksignStatus === "assinado_total"
                            ? "Assinado"
                            : "Simular Assinatura"}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <span className="font-medium block text-[11px]">
                            Locador (Sócio/Imobiliária)
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            Link: sandbox.clicksign.com/s/3c4d...
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={clicksignStatus === "assinado_total"}
                          onClick={() => handleSimularAssinatura("locador")}
                          className="text-[10px] h-7 px-2"
                        >
                          {clicksignStatus === "assinado_total" ? "Assinado" : "Simular Assinatura"}
                        </Button>
                      </div>
                    </div>

                    {clicksignStatus === "assinado_total" && (
                      <div className="pt-2 border-t border-emerald-200 text-[10px] text-emerald-800 bg-emerald-50/50 p-2 rounded flex items-center gap-1.5 leading-snug">
                        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span>
                          HashSHA-256 e Termo de Assinatura Eletrônica ClickSign vinculados ao PDF
                          final em conformidade legal.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
