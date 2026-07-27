import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ChevronRight, CheckCircle2 } from "lucide-react";
import { getMercadoPagoConnectionStatus } from "@/lib/mercadopagoOAuth.functions";

export const Route = createFileRoute("/app/configuracoes/integracoes-bancarias/")({
  head: () => ({ meta: [{ title: "Integrações bancárias — imob365" }] }),
  component: IntegracoesBancariasPage,
});

// Hub de integrações bancárias/gateways de pagamento com OAuth de verdade —
// cada banco/gateway vira uma sub-página própria (ver .../mercadopago),
// listada aqui como um card. Hoje só o Mercado Pago está implementado.
// Conciliação bancária e ERP (Fase 4) vivem em páginas próprias no menu de
// Configurações (não aqui), já que são cadastro administrativo genérico,
// não integrações OAuth por conta.
function IntegracoesBancariasPage() {
  const fetchMpStatus = useServerFn(getMercadoPagoConnectionStatus);
  const { data: mpStatus } = useQuery({
    queryKey: ["mercadopago-connection-status"],
    queryFn: () => fetchMpStatus(),
  });

  const conectado = mpStatus?.connected ?? false;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrações bancárias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte contas de bancos e gateways de pagamento pra cobrar diretamente do seu cliente
          final.
        </p>
      </header>

      <div className="max-w-xl space-y-3">
        <Link
          to="/app/configuracoes/integracoes-bancarias/mercadopago"
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Mercado Pago</p>
              <p className="text-sm text-muted-foreground">
                PIX, boleto e cartão pro cliente final da imobiliária.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conectado && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Conectado
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </div>
    </div>
  );
}
