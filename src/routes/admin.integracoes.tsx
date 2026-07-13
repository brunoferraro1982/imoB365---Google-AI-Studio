import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Link2, Globe, Mail, Rss, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/integracoes")({
  component: AdminIntegracoes,
});

type TenantRow = { id: string; nome: string };
type WebhookRow = { tenant_id: string; ativo: boolean };
type DeliveryRow = { tenant_id: string; status: string };
type DomainRow = { tenant_id: string; verificado: boolean };
type FeedRow = { tenant_id: string; enabled: boolean };
type EmailRow = { status: string };

function AdminIntegracoes() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [t, w, d, dom, f, e] = await Promise.all([
        supabase.from("tenants").select("id,nome").order("nome"),
        supabase.from("tenant_webhooks").select("tenant_id,ativo"),
        supabase
          .from("webhook_deliveries")
          .select("tenant_id,status")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("tenant_domains").select("tenant_id,verificado"),
        supabase.from("portal_feeds").select("tenant_id,enabled"),
        supabase
          .from("email_send_log")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setTenants((t.data as TenantRow[]) ?? []);
      setWebhooks((w.data as WebhookRow[]) ?? []);
      setDeliveries((d.data as DeliveryRow[]) ?? []);
      setDomains((dom.data as DomainRow[]) ?? []);
      setFeeds((f.data as FeedRow[]) ?? []);
      setEmails((e.data as EmailRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const agg = useMemo(() => {
    const webhooksAtivos = webhooks.filter((w) => w.ativo).length;
    const entregasOk = deliveries.filter((d) => d.status === "entregue").length;
    const entregasTotal = deliveries.length;
    const dominiosVerificados = domains.filter((d) => d.verificado).length;
    const emailsFalha = emails.filter((e) => e.status !== "sent").length;
    return {
      webhooksAtivos,
      taxaEntrega: entregasTotal > 0 ? Math.round((entregasOk / entregasTotal) * 100) : null,
      dominiosVerificados,
      dominiosTotal: domains.length,
      emailsFalha,
      emailsTotal: emails.length,
      feedsAtivos: feeds.filter((f) => f.enabled).length,
    };
  }, [webhooks, deliveries, domains, emails, feeds]);

  const porTenant = useMemo(() => {
    return tenants
      .map((t) => {
        const wh = webhooks.filter((w) => w.tenant_id === t.id);
        const dl = deliveries.filter((d) => d.tenant_id === t.id);
        const dm = domains.filter((d) => d.tenant_id === t.id);
        const fd = feeds.filter((f) => f.tenant_id === t.id);
        return {
          id: t.id,
          nome: t.nome,
          webhooksAtivos: wh.filter((w) => w.ativo).length,
          entregasOk: dl.filter((d) => d.status === "entregue").length,
          entregasTotal: dl.length,
          dominiosVerificados: dm.filter((d) => d.verificado).length,
          dominiosTotal: dm.length,
          feedsAtivos: fd.filter((f) => f.enabled).length,
        };
      })
      .filter(
        (r) =>
          r.webhooksAtivos > 0 || r.entregasTotal > 0 || r.dominiosTotal > 0 || r.feedsAtivos > 0,
      );
  }, [tenants, webhooks, deliveries, domains, feeds]);

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saúde das integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada, entre todos os tenants, de webhooks, domínios, e-mail e feeds de portal
          — cada imobiliária configura os próprios em{" "}
          <code className="rounded bg-muted px-1">/app/configuracoes</code>; aqui é só
          monitoramento.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Link2}
              label="Webhooks ativos"
              value={String(agg.webhooksAtivos)}
              sub={
                agg.taxaEntrega != null
                  ? `${agg.taxaEntrega}% de entregas OK`
                  : "sem entregas registradas"
              }
              tone={
                agg.taxaEntrega == null || agg.taxaEntrega >= 90
                  ? "text-emerald-600"
                  : "text-amber-600"
              }
            />
            <StatCard
              icon={Globe}
              label="Domínios verificados"
              value={`${agg.dominiosVerificados} / ${agg.dominiosTotal}`}
              sub="TXT confirmado"
              tone="text-emerald-600"
            />
            <StatCard
              icon={Mail}
              label="E-mails com falha"
              value={String(agg.emailsFalha)}
              sub={`de ${agg.emailsTotal} recentes`}
              tone={agg.emailsFalha > 0 ? "text-amber-600" : "text-emerald-600"}
            />
            <StatCard
              icon={Rss}
              label="Feeds de portal ativos"
              value={String(agg.feedsAtivos)}
              sub="VivaReal / ZAP / OLX"
              tone="text-emerald-600"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-semibold">Por imobiliária</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Imobiliária</th>
                  <th className="px-4 py-2">Webhooks ativos</th>
                  <th className="px-4 py-2">Entregas</th>
                  <th className="px-4 py-2">Domínios verificados</th>
                  <th className="px-4 py-2">Feeds ativos</th>
                </tr>
              </thead>
              <tbody>
                {porTenant.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum tenant com integrações configuradas ainda.
                    </td>
                  </tr>
                )}
                {porTenant.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{r.nome}</td>
                    <td className="px-4 py-2">{r.webhooksAtivos}</td>
                    <td className="px-4 py-2">
                      {r.entregasTotal > 0 ? (
                        <Badge
                          variant="outline"
                          className={
                            r.entregasOk === r.entregasTotal ? "text-emerald-600" : "text-amber-600"
                          }
                        >
                          {r.entregasOk === r.entregasTotal ? (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          ) : (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          )}
                          {r.entregasOk} / {r.entregasTotal}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.dominiosVerificados} / {r.dominiosTotal}
                    </td>
                    <td className="px-4 py-2">{r.feedsAtivos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <p className={`mt-1 text-xs ${tone}`}>{sub}</p>
    </div>
  );
}
