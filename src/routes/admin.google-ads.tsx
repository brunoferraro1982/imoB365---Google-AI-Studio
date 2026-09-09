import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, CheckCircle2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getGoogleAdsConnectionStatus,
  getGoogleAdsAuthorizeUrl,
  disconnectGoogleAds,
} from "@/lib/googleAdsOAuth.functions";
import {
  listarCampanhasParaAprovacao,
  aprovarCampanha,
  rejeitarCampanha,
} from "@/lib/googleAdsCampanhas.functions";
import { formatBRL } from "@/lib/format";

const GOOGLEADS_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "O Google não retornou os parâmetros esperados.",
  token_exchange_falhou: "O Google recusou a autorização — confira o Client ID/Secret no servidor.",
  sem_refresh_token:
    "O Google não devolveu um refresh token — desconecte o acesso em myaccount.google.com/permissions e tente de novo.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
};

// Google Ads — conta ÚNICA da própria imoB365, conectada só pelo
// super_admin (ver src/lib/googleAdsOAuth.functions.ts pro porquê: o
// Developer Token do Google Ads é emitido por empresa, não por tenant).
// Esta tela também concentra a fila de aprovação — ativar uma campanha
// aqui é o único jeito de ela sair do papel, já que o gasto real sai do
// cartão da imoB365.
export const Route = createFileRoute("/admin/google-ads")({
  head: () => ({ meta: [{ title: "Google Ads — imob365" }] }),
  component: GoogleAdsAdminPage,
});

function GoogleAdsAdminPage() {
  const search = useSearch({ strict: false }) as {
    googleads_connected?: string;
    googleads_error?: string;
  };
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [processando, setProcessando] = useState<string | null>(null);

  const fetchStatus = useServerFn(getGoogleAdsConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getGoogleAdsAuthorizeUrl);
  const desconectar = useServerFn(disconnectGoogleAds);
  const fetchCampanhas = useServerFn(listarCampanhasParaAprovacao);
  const aprovar = useServerFn(aprovarCampanha);
  const rejeitar = useServerFn(rejeitarCampanha);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["googleads-connection-status"],
    queryFn: () => fetchStatus(),
  });
  const { data: campanhas, refetch: refetchCampanhas } = useQuery({
    queryKey: ["googleads-campanhas-aprovacao"],
    queryFn: () => fetchCampanhas(),
  });

  useEffect(() => {
    if (search.googleads_connected) {
      toast.success("Conta Google Ads conectada com sucesso!");
      refetch();
    } else if (search.googleads_error) {
      toast.error(
        GOOGLEADS_ERROR_LABEL[search.googleads_error] ?? "Não foi possível conectar ao Google Ads.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onConectar() {
    setConectando(true);
    try {
      const { url } = await fetchAuthorizeUrl();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão");
      setConectando(false);
    }
  }

  async function onDesconectar() {
    if (!confirm("Isso desconecta a conta Google Ads da imoB365. Tem certeza?")) return;
    setDesconectando(true);
    try {
      await desconectar();
      toast.success("Conta Google Ads desconectada.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desconectar");
    } finally {
      setDesconectando(false);
    }
  }

  async function onAprovar(campanhaId: string) {
    const resourceName = resourceNames[campanhaId]?.trim();
    if (!resourceName) {
      toast.error("Cole o resource_name da campanha criada no painel do Google Ads.");
      return;
    }
    setProcessando(campanhaId);
    try {
      await aprovar({ data: { campanhaId, googleCampaignResourceName: resourceName } });
      toast.success("Campanha ativada.");
      refetchCampanhas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ativar campanha");
    } finally {
      setProcessando(null);
    }
  }

  async function onRejeitar(campanhaId: string) {
    const motivo = motivos[campanhaId]?.trim();
    if (!motivo) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setProcessando(campanhaId);
    try {
      await rejeitar({ data: { campanhaId, motivo } });
      toast.success("Campanha rejeitada.");
      setRejeitandoId(null);
      refetchCampanhas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao rejeitar campanha");
    } finally {
      setProcessando(null);
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const aguardando = (campanhas ?? []).filter((c: any) => c.status === "aguardando_ativacao");
  const historico = (campanhas ?? []).filter((c: any) => c.status !== "aguardando_ativacao");

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Target className="h-7 w-7 text-primary" /> Google Ads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conta única da imoB365 — imobiliárias e corretores só montam e pagam a campanha; a
          ativação real (que gera gasto no cartão da plataforma) é sempre feita aqui.
        </p>
      </header>

      <section className="mb-8 max-w-xl rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Conexão</h2>
          {data?.connected && (
            <Badge className="gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </Badge>
          )}
        </div>

        {!data?.appConfigured ? (
          <p className="text-sm text-muted-foreground">
            Configure <code className="text-xs">GOOGLE_ADS_CLIENT_ID</code>,{" "}
            <code className="text-xs">GOOGLE_ADS_CLIENT_SECRET</code> e{" "}
            <code className="text-xs">GOOGLE_ADS_DEVELOPER_TOKEN</code> nas variáveis de ambiente do
            servidor (criadas uma vez no Google Cloud + Google Ads API Center) antes de conectar.
          </p>
        ) : data?.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conta: <strong>{data.customerId ?? "—"}</strong>
            </p>
            <Button variant="outline" onClick={onDesconectar} disabled={desconectando}>
              {desconectando ? "Desconectando…" : "Desconectar conta"}
            </Button>
          </div>
        ) : (
          <Button onClick={onConectar} disabled={conectando}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {conectando ? "Redirecionando…" : "Conectar Google Ads"}
          </Button>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Aguardando ativação ({aguardando.length})</h2>
        {aguardando.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha paga aguardando ativação.
          </p>
        ) : (
          <div className="space-y-3">
            {aguardando.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.tenants?.nome ?? c.tenant_id} · {c.tipo_conteudo} · {c.duracao_dias} dias
                    </p>
                  </div>
                  <Badge variant="secondary">Aguardando ativação</Badge>
                </div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Palavras-chave: {c.palavras_chave}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Orçamento de mídia: {formatBRL(c.orcamento_periodo)} · Margem:{" "}
                  {c.margem_percentual}% · Valor cobrado: {formatBRL(c.valor_com_margem)}
                </p>

                {rejeitandoId === c.id ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Motivo da rejeição"
                      value={motivos[c.id] ?? ""}
                      onChange={(e) => setMotivos((m) => ({ ...m, [c.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRejeitar(c.id)}
                        disabled={processando === c.id}
                      >
                        Confirmar rejeição
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejeitandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[280px] flex-1 space-y-1">
                      <Label className="text-xs">
                        Resource name da campanha (criada manualmente no painel do Google Ads)
                      </Label>
                      <Input
                        placeholder="customers/1234567890/campaigns/987654321"
                        value={resourceNames[c.id] ?? ""}
                        onChange={(e) =>
                          setResourceNames((r) => ({ ...r, [c.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onAprovar(c.id)}
                      disabled={processando === c.id}
                    >
                      Ativar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejeitandoId(c.id)}>
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {historico.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Histórico</h2>
          <div className="space-y-2">
            {historico.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.tenants?.nome ?? c.tenant_id}</p>
                </div>
                <Badge variant={c.status === "ativa" ? "default" : "destructive"}>
                  {c.status === "ativa" ? "Ativa" : "Rejeitada"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
