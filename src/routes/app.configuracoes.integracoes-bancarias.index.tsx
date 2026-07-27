import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ChevronRight, CheckCircle2, Landmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMercadoPagoConnectionStatus } from "@/lib/mercadopagoOAuth.functions";
import {
  IntegracaoFinanceiraForm,
  type IntegracaoFinanceira,
} from "@/components/financeiro/IntegracaoFinanceiraForm";

export const Route = createFileRoute("/app/configuracoes/integracoes-bancarias/")({
  head: () => ({ meta: [{ title: "Integrações bancárias — imob365" }] }),
  component: IntegracoesBancariasPage,
});

const PROVIDER_LABEL: Record<string, string> = {
  bb: "Banco do Brasil",
  itau: "Itaú",
  bradesco: "Bradesco",
  santander: "Santander",
  nubank: "Nubank",
  caixa: "Caixa",
  conta_azul: "Conta Azul",
  omie: "Omie",
  outro: "Outro",
};

// Hub de integrações bancárias/gateways de pagamento. Duas seções:
// (1) integrações "especiais" com OAuth de verdade (hoje só Mercado Pago,
// cada uma com sua própria sub-página); (2) conciliação bancária & ERP
// (Fase 4 do módulo Financeiro) — cadastro administrativo genérico, sem
// nenhuma chamada real à API externa ainda (pedido explícito do usuário:
// fornecer o modelo/infra pra conexão, não precisa conectar de verdade).
function IntegracoesBancariasPage() {
  const { tenantId } = useAuth();
  const fetchMpStatus = useServerFn(getMercadoPagoConnectionStatus);
  const { data: mpStatus } = useQuery({
    queryKey: ["mercadopago-connection-status"],
    queryFn: () => fetchMpStatus(),
  });
  const conectado = mpStatus?.connected ?? false;

  const [integracoes, setIntegracoes] = useState<IntegracaoFinanceira[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("tenant_integracoes_financeiras")
      .select("id,tipo,provider,nome_exibicao,config,ativo")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setIntegracoes((data ?? []) as IntegracaoFinanceira[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function remover(id: string) {
    const { error } = await (supabase as any)
      .from("tenant_integracoes_financeiras")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Integração removida");
    load();
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrações bancárias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte contas de bancos e gateways de pagamento pra cobrar diretamente do seu cliente
          final.
        </p>
      </header>

      <div className="max-w-2xl space-y-3">
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

      <div className="mt-10 max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Conciliação bancária & ERP</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre os bancos e ERPs que sua imobiliária usa. Isso guarda os dados de conexão pra
              quando a sincronização automática for ativada — nenhuma chamada real ao banco/ERP é
              feita ainda.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {!loading &&
            integracoes.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-4">
                  <Landmark className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{i.nome_exibicao}</p>
                      <Badge variant="secondary">
                        {i.tipo === "erp" ? "ERP" : "Conciliação bancária"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {PROVIDER_LABEL[i.provider] ?? i.provider}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {i.ativo ? (
                    <span className="text-xs font-medium text-emerald-600">Ativa</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Inativa</span>
                  )}
                  <IntegracaoFinanceiraForm existing={i} onSaved={load} />
                  <Button variant="ghost" size="sm" onClick={() => remover(i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

          {!loading && integracoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada ainda.</p>
          )}
        </div>

        <div className="mt-4">
          <IntegracaoFinanceiraForm onSaved={load} />
        </div>
      </div>
    </div>
  );
}
