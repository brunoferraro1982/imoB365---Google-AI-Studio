import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getMercadoPagoConnectionStatus,
  getMercadoPagoAuthorizeUrl,
  disconnectMercadoPago,
} from "@/lib/mercadopagoOAuth.functions";
import { moduleGuard } from "@/lib/routeGuard";

const MP_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "O Mercado Pago não retornou os parâmetros esperados.",
  state_invalido: "A conexão expirou ou é inválida — tente novamente.",
  integracao_nao_configurada: "Integração com Mercado Pago Marketplace ainda não configurada.",
  token_exchange_falhou: "O Mercado Pago recusou a autorização — tente novamente.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
  erro_inesperado: "Erro inesperado ao conectar. Tente novamente.",
};

export const Route = createFileRoute("/app/configuracoes/mercadopago")({
  beforeLoad: moduleGuard("financeiro"),
  head: () => ({ meta: [{ title: "Mercado Pago — imob365" }] }),
  component: MercadoPagoSettingsPage,
});

// Conexão OAuth por tenant com o Mercado Pago Marketplace (Fase 3 do
// módulo Financeiro) — permite que a imobiliária receba PIX/boleto/cartão
// do próprio cliente final (inquilino/comprador) usando a conta MP dela,
// não a da plataforma. A criação da cobrança em si é uma etapa futura;
// esta tela só cobre conectar/desconectar a conta.
function MercadoPagoSettingsPage() {
  const search = useSearch({ strict: false }) as { mp_connected?: string; mp_error?: string };
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useServerFn(getMercadoPagoConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getMercadoPagoAuthorizeUrl);
  const disconnect = useServerFn(disconnectMercadoPago);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mercadopago-connection-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (search.mp_connected) {
      toast.success("Conta do Mercado Pago conectada com sucesso!");
      refetch();
    } else if (search.mp_error) {
      toast.error(MP_ERROR_LABEL[search.mp_error] ?? "Não foi possível conectar ao Mercado Pago.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function conectar() {
    setConnecting(true);
    try {
      const { url } = await fetchAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão");
      setConnecting(false);
    }
  }

  async function desconectar() {
    setDisconnecting(true);
    try {
      await disconnect();
      toast.success("Conta do Mercado Pago desconectada");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Mercado Pago</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte a conta Mercado Pago da imobiliária pra receber cobranças (PIX, boleto, cartão) do
          seu próprio cliente final.
        </p>
      </header>

      <div className="max-w-xl">
        <section className="rounded-xl border border-border bg-card p-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : data?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm">
                  <p className="font-medium">Conta conectada</p>
                  <p className="text-muted-foreground">
                    Desde{" "}
                    {data.connectedAt
                      ? new Date(data.connectedAt).toLocaleDateString("pt-BR")
                      : "—"}
                    {data.liveMode === false && " · modo teste (sandbox)"}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={desconectar} disabled={disconnecting}>
                {disconnecting ? "Desconectando…" : "Desconectar conta"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta Mercado Pago conectada ainda. Ao conectar, você autoriza a
                  plataforma a criar cobranças em nome da sua conta — o dinheiro cai direto pra
                  você, com a comissão da plataforma descontada automaticamente.
                </p>
              </div>
              <Button onClick={conectar} disabled={connecting}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {connecting ? "Redirecionando…" : "Conectar Mercado Pago"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
