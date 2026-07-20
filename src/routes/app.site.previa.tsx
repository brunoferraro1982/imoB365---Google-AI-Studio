import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Monitor, Smartphone, Sparkles, ArrowRight, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/site/previa")({
  component: PreviaPage,
});

function PreviaPage() {
  const { tenantId } = useAuth();
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [publicado, setPublicado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: cfg }] = await Promise.all([
        supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle(),
        supabase
          .from("tenant_site_settings")
          .select("publicado")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);
      setTenantSlug(t?.slug ?? "");
      setPublicado(Boolean(cfg?.publicado));
      setLoading(false);
    })();
  }, [tenantId]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const previewUrl = tenantSlug ? `/site/${tenantSlug}?preview=1` : "";
  const liveUrl = tenantSlug ? `/site/${tenantSlug}` : "";

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Prévia do Site</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja como está configurada a home pública da sua imobiliária agora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={publicado ? "default" : "secondary"}>
            {publicado ? "Publicado" : "Rascunho"}
          </Badge>
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={device === "desktop" ? "secondary" : "ghost"}
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </Button>
            <Button
              type="button"
              size="sm"
              variant={device === "mobile" ? "secondary" : "ghost"}
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </Button>
          </div>
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver em nova aba
              </Button>
            </a>
          )}
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm">
            Quer refazer o site do zero, escolher outro estilo ou revisar tudo passo a passo?
          </p>
        </div>
        <Link to="/app/site/assistente" className="shrink-0">
          <Button size="sm">
            Assistente de Configuração <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {!previewUrl ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Configure seu site em{" "}
          <Link to="/app/site" className="font-medium text-primary hover:underline">
            Site → Site da imobiliária
          </Link>{" "}
          para ver a prévia aqui.
        </div>
      ) : (
        <div className="flex justify-center rounded-xl border border-border bg-muted/20 p-4">
          <iframe
            key={device}
            src={previewUrl}
            title="Prévia do site"
            className="h-[75vh] rounded-lg border border-border bg-background transition-all"
            style={{ width: device === "mobile" ? 390 : "100%" }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      )}
    </div>
  );
}
