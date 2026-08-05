import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Copy, Check, AlertCircle, Info, Facebook, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PORTAIS } from "@/lib/portais";
import {
  getMetaConnectionStatus,
  getMetaAuthorizeUrl,
  disconnectMeta,
} from "@/lib/metaOAuth.functions";
import { toast } from "sonner";

const META_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "A Meta não retornou os parâmetros esperados.",
  state_invalido: "A conexão expirou ou é inválida — tente novamente.",
  integracao_nao_configurada: "Integração com a Meta ainda não configurada.",
  token_exchange_falhou: "A Meta recusou a autorização — tente novamente.",
  nenhuma_pagina: "Nenhuma Página do Facebook encontrada nessa conta.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
  erro_inesperado: "Erro inesperado ao conectar. Tente novamente.",
};

export const Route = createFileRoute("/app/portais")({
  component: PortaisPage,
});

type Feed = {
  portal_slug: string;
  enabled: boolean;
  last_pulled_at: string | null;
  last_pull_ua: string | null;
  validation_status: string | null;
  validation_message: string | null;
  credentials: Record<string, string> | null;
};

function PortaisPage() {
  const { tenantId, isAdmin } = useAuth();
  const search = useSearch({ strict: false }) as { meta_connected?: string; meta_error?: string };
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [imoveisAtivos, setImoveisAtivos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaDisconnecting, setMetaDisconnecting] = useState(false);

  const fetchMetaStatus = useServerFn(getMetaConnectionStatus);
  const fetchMetaAuthorizeUrl = useServerFn(getMetaAuthorizeUrl);
  const metaDisconnect = useServerFn(disconnectMeta);
  const {
    data: metaStatus,
    isLoading: metaLoading,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => fetchMetaStatus(),
  });

  useEffect(() => {
    if (search.meta_connected) {
      toast.success("Conta da Meta conectada com sucesso!");
      refetchMeta();
    } else if (search.meta_error) {
      toast.error(META_ERROR_LABEL[search.meta_error] ?? "Não foi possível conectar à Meta.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function conectarMeta() {
    setMetaConnecting(true);
    try {
      const { url } = await fetchMetaAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão");
      setMetaConnecting(false);
    }
  }

  async function desconectarMeta() {
    setMetaDisconnecting(true);
    try {
      await metaDisconnect();
      toast.success("Conta da Meta desconectada");
      refetchMeta();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desconectar");
    } finally {
      setMetaDisconnecting(false);
    }
  }

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: t }, { data: f }, { count }] = await Promise.all([
      supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle(),
      (supabase as any).from("portal_feeds").select("*").eq("tenant_id", tenantId),
      (supabase as any)
        .from("imoveis")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("publicado", true)
        .eq("status", "ativo"),
    ]);
    setTenantSlug(t?.slug ?? null);
    const map = Object.fromEntries(((f as Feed[]) ?? []).map((x) => [x.portal_slug, x]));
    setFeeds(map);
    setImoveisAtivos(count ?? 0);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function toggle(slug: string, enabled: boolean) {
    if (!tenantId) return;
    setFeeds((s) => ({
      ...s,
      [slug]: {
        ...(s[slug] ?? {
          portal_slug: slug,
          last_pulled_at: null,
          last_pull_ua: null,
          validation_status: null,
          validation_message: null,
          credentials: {},
        }),
        enabled,
      },
    }));
    const { error } = await (supabase as any)
      .from("portal_feeds")
      .upsert(
        { tenant_id: tenantId, portal_slug: slug, enabled },
        { onConflict: "tenant_id,portal_slug" },
      );
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  function feedUrl(suffix: string) {
    if (!tenantSlug) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/public/feeds/${tenantSlug}/${suffix}`;
  }

  async function copyUrl(slug: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(slug);
    toast.success("URL copiada");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Portais externos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Distribua seus imóveis automaticamente para VivaReal, ZAP e outros portais usando um feed
          XML.
        </p>
      </header>

      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground md:grid-cols-3">
        <div>
          <div className="text-2xl font-bold text-foreground">{imoveisAtivos}</div>imóveis
          publicados
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">
            {Object.values(feeds).filter((f) => f.enabled).length}
          </div>
          portais ativos
        </div>
        <div className="md:text-right">
          Cadastre a URL do feed no painel do portal para que ele leia os imóveis automaticamente.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-3">
          {PORTAIS.map((p) => {
            const feed = feeds[p.slug];
            const enabled = feed?.enabled ?? false;
            const url = feedUrl(p.feedSuffix);
            return (
              <div key={p.slug} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Globe2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.nome}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {p.formato}
                        </Badge>
                        {!p.disponivel && (
                          <Badge variant="secondary" className="text-[10px]">
                            Em breve
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={!isAdmin || !p.disponivel}
                    onCheckedChange={(v) => toggle(p.slug, v)}
                  />
                </div>

                {enabled && p.disponivel && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        URL do feed
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                          {url}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copyUrl(p.slug, url)}>
                          {copied === p.slug ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                      <div>
                        <span className="font-medium text-foreground">Última leitura:</span>{" "}
                        {feed?.last_pulled_at
                          ? new Date(feed.last_pulled_at).toLocaleString("pt-BR")
                          : "ainda não lido"}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Status:</span>{" "}
                        {feed?.validation_status ?? "—"}
                        {feed?.validation_message && (
                          <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-3 w-3" /> {feed.validation_message}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        Não é preciso nenhuma senha ou chave de API aqui. Copie a URL acima e cole
                        no painel de anúncios do próprio portal, no campo de{" "}
                        <strong>importação automática / feed XML</strong>. O portal passa a buscar
                        seus imóveis sozinho a partir dessa URL.
                      </span>
                    </div>
                  </div>
                )}

                {p.slug === "meta" && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Facebook className="h-3.5 w-3.5" /> Conexão com sua conta Meta
                    </div>
                    {metaLoading ? (
                      <div className="text-sm text-muted-foreground">Carregando…</div>
                    ) : metaStatus?.connected ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>
                            Conectado à página <strong>{metaStatus.pageName ?? "—"}</strong>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={desconectarMeta}
                          disabled={metaDisconnecting}
                        >
                          {metaDisconnecting ? "Desconectando…" : "Desconectar"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Conectar sua Página do Facebook permite (numa próxima etapa) receber de
                          volta os leads gerados por campanhas — opcional, o feed acima já funciona
                          sem conectar.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={conectarMeta}
                          disabled={metaConnecting}
                          className="shrink-0"
                        >
                          {metaConnecting ? "Redirecionando…" : "Conectar Facebook"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
