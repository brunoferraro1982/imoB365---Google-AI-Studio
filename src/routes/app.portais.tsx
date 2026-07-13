import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe2, Copy, Check, AlertCircle, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PORTAIS } from "@/lib/portais";
import { toast } from "sonner";

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
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [imoveisAtivos, setImoveisAtivos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
