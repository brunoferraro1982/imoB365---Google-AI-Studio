import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Globe2,
  Copy,
  Check,
  AlertCircle,
  Info,
  Users,
  HeartHandshake,
  Search,
  UserPlus,
  Clock,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ParceriaSettings = {
  ativo: boolean;
  split_captador: number;
  split_parceiro: number;
};

type ConviteStatus = "pendente" | "aceito" | "recusado" | "cancelado";

type ConviteRow = {
  id: string;
  tenant_solicitante_id: string;
  tenant_parceiro_id: string;
  status: ConviteStatus;
  solicitante: { nome: string; slug: string } | null;
  parceiro: { nome: string; slug: string } | null;
};

type ParceiroDisponivel = { tenant_id: string; nome: string; slug: string };

function PortaisPage() {
  const { tenantId, isAdmin, user } = useAuth();
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [imoveisAtivos, setImoveisAtivos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Parcerias entre imobiliárias (compartilhamento de imóveis + divisão de comissão)
  const [parceriaSettings, setParceriaSettings] = useState<ParceriaSettings>({
    ativo: false,
    split_captador: 50,
    split_parceiro: 50,
  });
  const [splitCaptadorDraft, setSplitCaptadorDraft] = useState("50");
  const [splitParceiroDraft, setSplitParceiroDraft] = useState("50");
  const [savingSplit, setSavingSplit] = useState(false);
  const [convites, setConvites] = useState<ConviteRow[]>([]);
  const [parceirosDisponiveis, setParceirosDisponiveis] = useState<ParceiroDisponivel[]>([]);
  const [buscaParceiro, setBuscaParceiro] = useState("");
  const [solicitando, setSolicitando] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [parceiroCounts, setParceiroCounts] = useState<Record<string, number>>({});
  const [loadingParcerias, setLoadingParcerias] = useState(true);

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

  async function loadParcerias() {
    if (!tenantId) return;
    setLoadingParcerias(true);
    const [{ data: settings }, { data: convitesData }, { data: disponiveis }] = await Promise.all([
      (supabase as any)
        .from("parcerias_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      (supabase as any)
        .from("parcerias_convites")
        .select(
          "id,tenant_solicitante_id,tenant_parceiro_id,status,solicitante:tenant_solicitante_id(nome,slug),parceiro:tenant_parceiro_id(nome,slug)",
        )
        .or(`tenant_solicitante_id.eq.${tenantId},tenant_parceiro_id.eq.${tenantId}`),
      (supabase as any)
        .from("parcerias_settings")
        .select("tenant_id,tenants:tenant_id(nome,slug)")
        .eq("ativo", true)
        .neq("tenant_id", tenantId),
    ]);
    setParceriaSettings({
      ativo: settings?.ativo ?? false,
      split_captador: settings?.split_captador ?? 50,
      split_parceiro: settings?.split_parceiro ?? 50,
    });
    setSplitCaptadorDraft(String(settings?.split_captador ?? 50));
    setSplitParceiroDraft(String(settings?.split_parceiro ?? 50));
    setConvites((convitesData as ConviteRow[]) ?? []);
    setParceirosDisponiveis(
      ((disponiveis as any[]) ?? [])
        .filter((d) => d.tenants?.nome)
        .map((d) => ({ tenant_id: d.tenant_id, nome: d.tenants.nome, slug: d.tenants.slug })),
    );
    setLoadingParcerias(false);
  }
  useEffect(() => {
    loadParcerias();
  }, [tenantId]);

  useEffect(() => {
    const aceitos = convites.filter((c) => c.status === "aceito");
    const partnerIds = aceitos.map((c) =>
      c.tenant_solicitante_id === tenantId ? c.tenant_parceiro_id : c.tenant_solicitante_id,
    );
    if (!partnerIds.length) return;
    (async () => {
      const entries = await Promise.all(
        partnerIds.map(async (pid) => {
          const { count } = await supabase
            .from("imoveis")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", pid)
            .eq("publicado", true)
            .eq("status", "ativo");
          return [pid, count ?? 0] as const;
        }),
      );
      setParceiroCounts(Object.fromEntries(entries));
    })();
  }, [convites, tenantId]);

  async function toggleParceriaAtiva(ativo: boolean) {
    if (!tenantId) return;
    setParceriaSettings((s) => ({ ...s, ativo }));
    const { error } = await (supabase as any).from("parcerias_settings").upsert(
      {
        tenant_id: tenantId,
        ativo,
        split_captador: parceriaSettings.split_captador,
        split_parceiro: parceriaSettings.split_parceiro,
      },
      { onConflict: "tenant_id" },
    );
    if (error) {
      toast.error(error.message);
      loadParcerias();
      return;
    }
    toast.success(
      ativo
        ? "Você está participando da rede de parceiros."
        : "Participação na rede de parceiros desativada.",
    );
  }

  async function salvarSplit() {
    if (!tenantId) return;
    const captador = Number(splitCaptadorDraft);
    const parceiro = Number(splitParceiroDraft);
    if (!Number.isFinite(captador) || !Number.isFinite(parceiro) || captador + parceiro !== 100) {
      toast.error("A soma das duas partes precisa dar 100%.");
      return;
    }
    setSavingSplit(true);
    const { error } = await (supabase as any).from("parcerias_settings").upsert(
      {
        tenant_id: tenantId,
        ativo: parceriaSettings.ativo,
        split_captador: captador,
        split_parceiro: parceiro,
      },
      { onConflict: "tenant_id" },
    );
    setSavingSplit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setParceriaSettings((s) => ({ ...s, split_captador: captador, split_parceiro: parceiro }));
    toast.success("Divisão de comissão salva");
  }

  async function solicitarParceria(parceiroTenantId: string) {
    if (!tenantId) return;
    setSolicitando(parceiroTenantId);
    const { error } = await (supabase as any).from("parcerias_convites").insert({
      tenant_solicitante_id: tenantId,
      tenant_parceiro_id: parceiroTenantId,
      created_by: user?.id ?? null,
    });
    setSolicitando(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pedido de parceria enviado");
    loadParcerias();
  }

  async function responderConvite(id: string, status: "aceito" | "recusado") {
    setRespondendo(id);
    const { error } = await (supabase as any)
      .from("parcerias_convites")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    setRespondendo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "aceito" ? "Parceria aceita!" : "Pedido recusado");
    loadParcerias();
  }

  async function cancelarConvite(id: string) {
    setRespondendo(id);
    const { error } = await (supabase as any)
      .from("parcerias_convites")
      .update({ status: "cancelado", responded_at: new Date().toISOString() })
      .eq("id", id);
    setRespondendo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pedido cancelado");
    loadParcerias();
  }

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

  const relacionamentoPorTenant = new Map<string, ConviteRow>();
  convites.forEach((c) => {
    const outroId =
      c.tenant_solicitante_id === tenantId ? c.tenant_parceiro_id : c.tenant_solicitante_id;
    relacionamentoPorTenant.set(outroId, c);
  });
  const pendentesRecebidos = convites.filter(
    (c) => c.status === "pendente" && c.tenant_parceiro_id === tenantId,
  );
  const pendentesEnviados = convites.filter(
    (c) => c.status === "pendente" && c.tenant_solicitante_id === tenantId,
  );
  const parceriasAceitas = convites.filter((c) => c.status === "aceito");
  const buscaResultados = parceirosDisponiveis.filter((p) =>
    p.nome.toLowerCase().includes(buscaParceiro.trim().toLowerCase()),
  );

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

      {/* Parcerias entre imobiliárias (compartilhamento de imóveis + divisão de comissão) */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 font-sans">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 text-emerald-800 p-2">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Parcerias entre imobiliárias</h2>
              <p className="text-xs text-muted-foreground">
                Compartilhe seus imóveis publicados com outras imobiliárias parceiras e combine,
                desde já, como dividir a comissão quando fecharem negócio juntos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Participar da rede de parceiros
            </span>
            <Switch checked={parceriaSettings.ativo} onCheckedChange={toggleParceriaAtiva} />
          </div>
        </div>

        {loadingParcerias ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : !parceriaSettings.ativo ? (
          <p className="text-xs text-muted-foreground">
            Ative para aparecer na busca de outras imobiliárias e poder solicitar ou receber pedidos
            de parceria.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr,340px] text-xs">
            <div className="space-y-4">
              <div className="p-4 bg-muted/40 border border-border/50 rounded-lg space-y-3">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                  Como dividir a comissão
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Quando uma parceria fechar negócio junto — um trouxe o imóvel, o outro trouxe o
                  cliente — esta é a divisão combinada como ponto de partida. Os detalhes finais
                  vocês continuam acertando entre si.
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] text-muted-foreground">
                      Quem cadastrou o imóvel
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-8 text-xs"
                        value={splitCaptadorDraft}
                        onChange={(e) => setSplitCaptadorDraft(e.target.value)}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] text-muted-foreground">
                      Quem trouxe o cliente
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-8 text-xs"
                        value={splitParceiroDraft}
                        onChange={(e) => setSplitParceiroDraft(e.target.value)}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={salvarSplit} disabled={savingSplit}>
                    {savingSplit ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-muted/40 border border-border/50 rounded-lg space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                  Seus imóveis visíveis para parceiros
                </span>
                <div className="text-sm font-bold text-emerald-600 pt-1">
                  {imoveisAtivos} imóveis
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Todo imóvel que já está publicado e ativo no seu site fica automaticamente visível
                  para as imobiliárias parceiras conectadas — não precisa marcar nada extra.
                </p>
              </div>

              <div className="border border-dashed border-border rounded-lg bg-muted/10 p-4 text-[11px] text-muted-foreground">
                Em breve: sugestões automáticas de imóveis de parceiros para os clientes que você já
                tem cadastrados.
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-border bg-muted/20 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Search className="h-4 w-4 text-primary" /> Buscar imobiliárias parceiras
                </div>
                <Input
                  placeholder="Nome da imobiliária…"
                  value={buscaParceiro}
                  onChange={(e) => setBuscaParceiro(e.target.value)}
                  className="h-8 text-xs"
                />
                {buscaParceiro.trim().length >= 2 && (
                  <ul className="space-y-2">
                    {buscaResultados.length === 0 && (
                      <p className="text-muted-foreground">
                        Nenhuma imobiliária encontrada com participação ativa.
                      </p>
                    )}
                    {buscaResultados.map((p) => {
                      const relacao = relacionamentoPorTenant.get(p.tenant_id);
                      return (
                        <li
                          key={p.tenant_id}
                          className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                        >
                          <span className="font-medium text-foreground">{p.nome}</span>
                          {!relacao && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={solicitando === p.tenant_id}
                              onClick={() => solicitarParceria(p.tenant_id)}
                            >
                              <UserPlus className="mr-1 h-3 w-3" /> Solicitar
                            </Button>
                          )}
                          {relacao?.status === "pendente" && (
                            <Badge variant="outline" className="text-[10px]">
                              Convite enviado
                            </Badge>
                          )}
                          {relacao?.status === "aceito" && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              Parceria ativa
                            </Badge>
                          )}
                          {relacao?.status === "recusado" && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Recusado
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {pendentesRecebidos.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px] uppercase tracking-wider">
                    <Clock className="h-4 w-4" /> Pedidos recebidos
                  </div>
                  <ul className="space-y-2">
                    {pendentesRecebidos.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {c.solicitante?.nome ?? "Imobiliária"}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            disabled={respondendo === c.id}
                            onClick={() => responderConvite(c.id, "aceito")}
                          >
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            disabled={respondendo === c.id}
                            onClick={() => responderConvite(c.id, "recusado")}
                          >
                            Recusar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pendentesEnviados.length > 0 && (
                <div className="border border-border bg-muted/20 p-4 rounded-lg space-y-2 text-[11px] text-muted-foreground">
                  {pendentesEnviados.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span>
                        Aguardando resposta de{" "}
                        <strong className="text-foreground">{c.parceiro?.nome}</strong>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        disabled={respondendo === c.id}
                        onClick={() => cancelarConvite(c.id)}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-border bg-muted/20 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" /> Imobiliárias parceiras
                </div>
                {parceriasAceitas.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhuma parceria ativa ainda. Busque acima para começar.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {parceriasAceitas.map((c) => {
                      const parceiroId =
                        c.tenant_solicitante_id === tenantId
                          ? c.tenant_parceiro_id
                          : c.tenant_solicitante_id;
                      const parceiro =
                        c.tenant_solicitante_id === tenantId ? c.parceiro : c.solicitante;
                      return (
                        <li
                          key={c.id}
                          className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0"
                        >
                          <div>
                            <span className="font-semibold block text-xs">{parceiro?.nome}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Parceria ativa
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              {parceiroCounts[parceiroId] ?? 0} imóveis
                            </Badge>
                            {parceiro?.slug && (
                              <a
                                href={`/site/${parceiro.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
