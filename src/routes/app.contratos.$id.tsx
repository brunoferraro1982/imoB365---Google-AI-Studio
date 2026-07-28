import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer, Banknote, BadgeCheck, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ContratoForm } from "@/components/contratos/ContratoForm";
import { PartesSection } from "@/components/contratos/PartesSection";
import { ParcelasSection } from "@/components/contratos/ParcelasSection";
import { ContratoChecklist } from "@/components/contratos/ContratoChecklist";
import { EtapasStepper } from "@/components/contratos/EtapasStepper";
import { ReajusteSection } from "@/components/contratos/ReajusteSection";
import { GarantiasSection } from "@/components/contratos/GarantiasSection";
import { DadosPagamentoSection } from "@/components/contratos/DadosPagamentoSection";
import { DocumentoUpload } from "@/components/contratos/DocumentoUpload";
import { AssinaturaEletronicaPanel } from "@/components/contratos/AssinaturaEletronicaPanel";

export const Route = createFileRoute("/app/contratos/$id")({
  component: EditarContrato,
});

function EditarContrato() {
  const { id } = Route.useParams();
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [comissaoGerada, setComissaoGerada] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (supabase as any)
      .from("contratos")
      .select("tipo")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: { tipo: string } | null }) => setTipoContrato(data?.tipo ?? null));
  }, [id]);

  // Carrega se já existe comissão para este contrato — no máximo uma por
  // contrato (trava também aplicada no banco, ver comissoes_unique_contrato).
  useEffect(() => {
    if (!id) return;
    supabase
      .from("comissoes")
      .select("id")
      .eq("contrato_id", id)
      .maybeSingle()
      .then(({ data }) => setComissaoGerada(!!data));
  }, [id]);

  function gerarComissao() {
    if (comissaoGerada) return toast.error("Comissão já gerada para este contrato");
    // Encaminha pro formulário de comissões (fonte única — ver ComissaoForm),
    // já pré-preenchido com o contrato e os valores sugeridos por ele. Antes
    // este botão inseria direto em lancamentos_financeiros, criando uma
    // segunda fonte de comissão desconectada da tabela `comissoes` (que
    // alimenta /app/comissoes) — corrigido pra sempre passar por lá.
    navigate({ to: "/app/comissoes/novo", search: { contrato_id: id } });
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
          <Button
            variant="outline"
            size="sm"
            onClick={gerarComissao}
            disabled={comissaoGerada}
            title={comissaoGerada ? "Já existe uma comissão para este contrato" : undefined}
          >
            {comissaoGerada ? (
              <BadgeCheck className="mr-2 h-4 w-4" />
            ) : (
              <Banknote className="mr-2 h-4 w-4" />
            )}
            {comissaoGerada ? "Comissão já gerada" : "Gerar comissão"}
          </Button>
          <Link to="/app/contratos/$id/imprimir" params={{ id }}>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl space-y-6">
        <EtapasStepper contratoId={id} />
        <ContratoForm contratoId={id} />
        <PartesSection contratoId={id} />
        <ParcelasSection contratoId={id} />
        <DocumentoUpload contratoId={id} />
        {(tipoContrato === "locacao" || tipoContrato === "administracao") && (
          <>
            <ReajusteSection contratoId={id} />
            <GarantiasSection contratoId={id} />
            <DadosPagamentoSection contratoId={id} />
          </>
        )}

        {tenantId && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Checklist */}
            <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Checklist de documentos
              </h2>
              <ContratoChecklist contratoId={id} tenantId={tenantId} />
            </section>

            <AssinaturaEletronicaPanel contratoId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
