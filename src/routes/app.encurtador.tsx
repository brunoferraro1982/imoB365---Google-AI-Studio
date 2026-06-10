import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link2, Copy, Check, Plus, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/encurtador")({
  component: EncurtadorPage,
});

type Link = {
  id: string;
  slug: string;
  target_url: string;
  label: string | null;
  clicks_count: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

function randomSlug() {
  return Math.random().toString(36).slice(2, 8);
}

function qrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`;
}

function EncurtadorPage() {
  const { tenantId } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [form, setForm] = useState({
    target_url: "",
    label: "",
    slug: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("short_links")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setLinks((data as Link[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function criar() {
    if (!tenantId || !form.target_url) return;
    setCreating(true);
    const slug = form.slug || randomSlug();
    const { error } = await (supabase as any).from("short_links").insert({
      tenant_id: tenantId,
      slug,
      target_url: form.target_url,
      label: form.label || null,
      utm_source: form.utm_source || null,
      utm_medium: form.utm_medium || null,
      utm_campaign: form.utm_campaign || null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link criado");
    setForm({
      target_url: "",
      label: "",
      slug: "",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
    });
    load();
  }

  async function remover(id: string) {
    if (!confirm("Remover este link?")) return;
    const { error } = await (supabase as any).from("short_links").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Encurtador de links & QR Code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere links curtos rastreáveis para anúncios, placas físicas e campanhas.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Novo link</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>URL de destino *</Label>
            <Input
              value={form.target_url}
              onChange={(e) => setForm((s) => ({ ...s, target_url: e.target.value }))}
              placeholder="https://imob365.com.br/imovel/..."
            />
          </div>
          <div>
            <Label>Descrição interna</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
              placeholder="Ex: Placa apto Jardins"
            />
          </div>
          <div>
            <Label>Slug (opcional)</Label>
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                }))
              }
              placeholder="placa-jardins"
            />
          </div>
          <div>
            <Label>UTM source</Label>
            <Input
              value={form.utm_source}
              onChange={(e) => setForm((s) => ({ ...s, utm_source: e.target.value }))}
              placeholder="placa"
            />
          </div>
          <div>
            <Label>UTM medium</Label>
            <Input
              value={form.utm_medium}
              onChange={(e) => setForm((s) => ({ ...s, utm_medium: e.target.value }))}
              placeholder="offline"
            />
          </div>
          <div className="md:col-span-2">
            <Label>UTM campaign</Label>
            <Input
              value={form.utm_campaign}
              onChange={(e) => setForm((s) => ({ ...s, utm_campaign: e.target.value }))}
              placeholder="lancamento-2026"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={criar} disabled={creating || !form.target_url}>
          <Plus className="mr-2 h-4 w-4" />
          Criar link
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum link curto criado ainda.
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map((l) => {
            const short = `${origin}/l/${l.slug}`;
            return (
              <div key={l.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{l.label ?? l.slug}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {l.clicks_count} cliques
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                        {short}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(short);
                          setCopied(l.id);
                          toast.success("Copiado");
                          setTimeout(() => setCopied(null), 1500);
                        }}
                      >
                        {copied === l.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowQr(showQr === l.id ? null : l.id)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remover(l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      → {l.target_url}
                    </div>
                  </div>
                  {showQr === l.id && (
                    <img
                      src={qrUrl(short)}
                      alt="QR Code"
                      className="h-32 w-32 rounded border border-border"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
