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
import { FluxoContrato } from "@/components/contratos/FluxoContrato";
import { ModelosVinculados } from "@/components/contratos/ModelosVinculados";
import { ReajusteSection } from "@/components/contratos/ReajusteSection";
import { GarantiasSection } from "@/components/contratos/GarantiasSection";
import { DadosPagamentoSection } from "@/components/contratos/DadosPagamentoSection";
import { DocumentoUpload } from "@/components/contratos/DocumentoUpload";
import { AssinaturaEletronicaPanel } from "@/components/contratos/AssinaturaEletronicaPanel";
import { HistoricoContrato } from "@/components/contratos/HistoricoContrato";
import { ResumoExecutivoContrato } from "@/components/contratos/ResumoExecutivoContrato";

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
    <div className="mesh-brand-claro min-h-full p-4 md:p-8">
      <Link
        to="/app/contratos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="glass-fosco rounded-3xl border border-white/40 p-6 md:p-8 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Editar contrato
        </h1>
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
        {tipoContrato && (
          <section className="glass-fosco space-y-4 rounded-3xl border border-white/40 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4 text-primary" /> Fluxo do contrato
              </h2>
              <Link to="/app/contratos/checklist" className="text-xs font-semibold text-primary">
                Modelos de checklist
              </Link>
            </div>
            <FluxoContrato contratoId={id} tipoContrato={tipoContrato} />
          </section>
        )}
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

        {tipoContrato && <ModelosVinculados contratoId={id} tipoContrato={tipoContrato} />}

        {tenantId && (
          <div className="grid gap-6 md:grid-cols-2">
            <AssinaturaEletronicaPanel contratoId={id} />
          </div>
        )}

        <ResumoExecutivoContrato contratoId={id} />
        <HistoricoContrato contratoId={id} />
      </div>
    </div>
  );
}
