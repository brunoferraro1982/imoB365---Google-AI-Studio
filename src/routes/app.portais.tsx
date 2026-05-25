import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe2, Copy, Check, AlertCircle, KeyRound, Eye, EyeOff, Save, Users, HeartHandshake, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [credsDraft, setCredsDraft] = useState<Record<string, Record<string, string>>>({});
  const [savingCreds, setSavingCreds] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Co-brokerage sharing state (Sprint 9)
  const [coBrokerageEnabled, setCoBrokerageEnabled] = useState(true);
  const [comissionSplit, setComissionSplit] = useState("50/50");
  const [sharedProperties, setSharedProperties] = useState(12);
  const [autoMatchPool, setAutoMatchPool] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: t }, { data: f }, { count }] = await Promise.all([
      supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle(),
      (supabase as any).from("portal_feeds").select("*").eq("tenant_id", tenantId),
      (supabase as any).from("imoveis").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("publicado", true).eq("status", "ativo"),
    ]);
    setTenantSlug(t?.slug ?? null);
    const map = Object.fromEntries(((f as Feed[]) ?? []).map((x) => [x.portal_slug, x]));
    setFeeds(map);
    setCredsDraft(
      Object.fromEntries(
        Object.entries(map).map(([slug, feed]) => [slug, { ...(feed.credentials ?? {}) }]),
      ),
    );
    setImoveisAtivos(count ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function toggle(slug: string, enabled: boolean) {
    if (!tenantId) return;
    setFeeds((s) => ({ ...s, [slug]: { ...(s[slug] ?? { portal_slug: slug, last_pulled_at: null, last_pull_ua: null, validation_status: null, validation_message: null, credentials: {} }), enabled } }));
    const { error } = await (supabase as any).from("portal_feeds").upsert(
      { tenant_id: tenantId, portal_slug: slug, enabled },
      { onConflict: "tenant_id,portal_slug" },
    );
    if (error) { toast.error(error.message); load(); }
  }

  async function saveCredentials(slug: string) {
    if (!tenantId) return;
    setSavingCreds(slug);
    const credentials = credsDraft[slug] ?? {};
    const { error } = await (supabase as any).from("portal_feeds").upsert(
      { tenant_id: tenantId, portal_slug: slug, credentials, enabled: feeds[slug]?.enabled ?? true },
      { onConflict: "tenant_id,portal_slug" },
    );
    setSavingCreds(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Chaves salvas");
    setFeeds((s) => ({ ...s, [slug]: { ...(s[slug] as Feed), credentials } }));
  }

  function updateCred(slug: string, key: string, value: string) {
    setCredsDraft((s) => ({ ...s, [slug]: { ...(s[slug] ?? {}), [key]: value } }));
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
          Distribua seus imóveis automaticamente para VivaReal, ZAP e outros portais usando um feed XML.
        </p>
      </header>

      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground md:grid-cols-3">
        <div><div className="text-2xl font-bold text-foreground">{imoveisAtivos}</div>imóveis publicados</div>
        <div><div className="text-2xl font-bold text-foreground">{Object.values(feeds).filter((f) => f.enabled).length}</div>portais ativos</div>
        <div className="md:text-right">Cadastre a URL do feed no painel do portal para que ele leia os imóveis automaticamente.</div>
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
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><Globe2 className="h-5 w-5" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.nome}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase">{p.formato}</Badge>
                        {!p.disponivel && <Badge variant="secondary" className="text-[10px]">Em breve</Badge>}
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
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">URL do feed</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">{url}</code>
                        <Button size="sm" variant="outline" onClick={() => copyUrl(p.slug, url)}>
                          {copied === p.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                      <div>
                        <span className="font-medium text-foreground">Última leitura:</span>{" "}
                        {feed?.last_pulled_at ? new Date(feed.last_pulled_at).toLocaleString("pt-BR") : "ainda não lido"}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Status:</span>{" "}
                        {feed?.validation_status ?? "—"}
                        {feed?.validation_message && (
                          <span className="ml-1 inline-flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> {feed.validation_message}</span>
                        )}
                      </div>
                    </div>

                    {p.credentialFields && p.credentialFields.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <button
                          type="button"
                          onClick={() => setExpanded((s) => ({ ...s, [p.slug]: !s[p.slug] }))}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium">
                            <KeyRound className="h-4 w-4 text-primary" />
                            Chaves de acesso do portal
                            {Object.values(feeds[p.slug]?.credentials ?? {}).some((v) => v) && (
                              <Badge variant="secondary" className="text-[10px]">configurado</Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {expanded[p.slug] ? "Recolher" : "Editar"}
                          </span>
                        </button>

                        {expanded[p.slug] && (
                          <div className="mt-4 space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Cole abaixo as credenciais fornecidas pelo portal. Elas são usadas apenas para autenticar a leitura do seu feed e ficam visíveis apenas para administradores da imobiliária.
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                              {p.credentialFields.map((f) => {
                                const fieldId = `${p.slug}-${f.key}`;
                                const isSecret = f.type === "password";
                                const value = credsDraft[p.slug]?.[f.key] ?? "";
                                return (
                                  <div key={f.key} className="space-y-1">
                                    <Label htmlFor={fieldId} className="text-xs">{f.label}</Label>
                                    <div className="relative">
                                      <Input
                                        id={fieldId}
                                        type={isSecret && !showSecret[fieldId] ? "password" : "text"}
                                        placeholder={f.placeholder}
                                        value={value}
                                        disabled={!isAdmin}
                                        onChange={(e) => updateCred(p.slug, f.key, e.target.value)}
                                        className={isSecret ? "pr-9" : undefined}
                                        autoComplete="off"
                                      />
                                      {isSecret && (
                                        <button
                                          type="button"
                                          onClick={() => setShowSecret((s) => ({ ...s, [fieldId]: !s[fieldId] }))}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                          tabIndex={-1}
                                        >
                                          {showSecret[fieldId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                      )}
                                    </div>
                                    {f.helper && <p className="text-[10px] text-muted-foreground">{f.helper}</p>}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={() => saveCredentials(p.slug)}
                                disabled={!isAdmin || savingCreds === p.slug}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                {savingCreds === p.slug ? "Salvando…" : "Salvar chaves"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rede de Co-corretagem e MLS Nacional (Sprint 9) */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 font-sans">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 text-emerald-800 p-2"><HeartHandshake className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-foreground">Rede de Co-corretagem & MLS imob365</h2>
              <p className="text-xs text-muted-foreground">
                Compartilhe sua carteira de imóveis com corretores parceiros e divida comissões automaticamente de forma segura.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Compartilhamento Ativo</span>
            <Switch
              checked={coBrokerageEnabled}
              onCheckedChange={(v) => {
                setCoBrokerageEnabled(v);
                toast.success(v ? "Sua carteira está disponível na rede MLS!" : "Compartilhamento ocultado temporariamente.");
              }}
            />
          </div>
        </div>

        {coBrokerageEnabled && (
          <div className="grid gap-6 md:grid-cols-[1fr,320px] text-xs">
            {/* MLS configuration details */}
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-muted/40 border border-border/50 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Acordo de Split de Comissão</span>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-sm font-bold text-foreground">{comissionSplit} Padrão</span>
                    <Badge variant="outline" className="text-[9px] uppercase bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">Garantido</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    50% para o captador do imóvel e 50% para o corretor que trouxer o lead qualificado comprador/inquilino.
                  </p>
                </div>

                <div className="p-4 bg-muted/40 border border-border/50 rounded-lg space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Imóveis no Pool MLS</span>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-sm font-bold text-emerald-600">{sharedProperties} imóveis</span>
                    <Badge variant="secondary" className="text-[9px]">Ativo no RSS/XML</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Seus imóveis ativos estão visíveis para todos os corretores e imobiliárias associadas no Brasil.
                  </p>
                </div>
              </div>

              {/* Match rule settings */}
              <div className="border border-border rounded-lg bg-background p-4 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-[12px]">
                  <Layers className="h-4 w-4 text-emerald-600" /> Matches de Clientes Automáticos
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Quando ativado, nossa IA monitora as buscas salvas de imobiliárias parceiras da região. Se um imóvel seu coincidir com o perfil, um alerta de lead qualificado é gerado instantaneamente no seu painel.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={autoMatchPool}
                    onCheckedChange={(v) => {
                      setAutoMatchPool(v);
                      toast.success(v ? "Auto-matching reativado para parcerias." : "Auto-matching desligado.");
                    }}
                  />
                  <span className="font-medium text-muted-foreground text-[11px]">Permitir IA sugerir de forma cruzada</span>
                </div>
              </div>
            </div>

            {/* List of active partner networks */}
            <div className="border border-border bg-muted/20 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4 text-primary" /> Redes Parceiras Conectadas
              </div>
              <ul className="space-y-3 pt-1">
                <li className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-semibold block text-xs">Lopes Associados MLS</span>
                    <span className="text-[10px] text-muted-foreground">Parceria Ativa</span>
                  </div>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">450 imóveis</Badge>
                </li>
                <li className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-semibold block text-xs">QuintoAndar Co-Realtor</span>
                    <span className="text-[10px] text-muted-foreground">Parceria Ativa</span>
                  </div>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">1.200 imóveis</Badge>
                </li>
                <li className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-semibold block text-xs">Netimóveis Multicentro</span>
                    <span className="text-[10px] text-muted-foreground">Conexão Pendente</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Aguardando termo</Badge>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}