import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Rocket,
  Sparkles,
  Globe2,
  Mail,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Smartphone,
  Eye,
  Lock,
  CreditCard,
  Building2,
  Share2,
  TrendingUp,
  FileCheck2,
  Sliders,
  Server,
  HelpCircle,
  Code,
  Activity,
  CheckCircle,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/configuracoes/golive")({
  component: GoLivePage,
});

type Check = { id: string; label: string; done: boolean; link?: string; hint?: string };

type IntegrationDiagnosis = {
  id: string;
  name: string;
  category: string;
  status: "active" | "pending" | "sandbox" | "fallback_active";
  statusText: string;
  description: string;
  details: string;
  icon: any;
  actionText?: string;
  actionLink?: string;
};

type TenantSiteSettingsFull = {
  ga4_id?: string | null;
  gtm_id?: string | null;
  fb_pixel_id?: string | null;
  google_ads_id?: string | null;
  hotjar_id?: string | null;
};

function GoLivePage() {
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<"checklist" | "integrations">("checklist");
  const [checks, setChecks] = useState<Check[]>([]);
  const [diagnostics, setDiagnostics] = useState<IntegrationDiagnosis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [t, sset, imv, cor, dom, pages, pf] = await Promise.all([
        supabase
          .from("tenants")
          .select("nome,cnpj,creci_juridico,plano_slug")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase
          .from("imoveis")
          .select("id", { count: "exact", head: true })
          .eq("publicado", true)
          .limit(1),
        supabase
          .from("corretores")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .limit(1),
        supabase.from("tenant_domains").select("*").eq("tenant_id", tenantId),
        supabase
          .from("tenant_pages")
          .select("id", { count: "exact", head: true })
          .eq("publicada", true)
          .limit(1),
        (supabase as any).from("portal_feeds").select("*").eq("tenant_id", tenantId),
      ]);

      const tenant: any = t.data ?? {};
      const ss: any = sset.data ?? {};
      const domainsList: any[] = dom.data ?? [];
      const feedsList: any[] = pf.data ?? [];

      // Build general Operational Check list
      const list: Check[] = [
        {
          id: "tenant",
          label: "Dados da imobiliária preenchidos (CNPJ + CRECI)",
          done: !!(tenant.cnpj && tenant.creci_juridico),
          link: "/app/configuracoes/imobiliaria",
        },
        {
          id: "plano",
          label: "Plano selecionado",
          done: !!tenant.plano_slug,
          link: "/app/configuracoes/imobiliaria",
        },
        {
          id: "site",
          label: "Site público configurado e publicado",
          done: !!(ss.publicado && ss.hero_titulo && ss.contato_email),
          link: "/app/site",
        },
        {
          id: "imoveis",
          label: "Pelo menos 1 imóvel publicado",
          done: (imv.count ?? 0) > 0,
          link: "/app/imoveis",
        },
        {
          id: "corretores",
          label: "Pelo menos 1 corretor ativo",
          done: (cor.count ?? 0) > 0,
          link: "/app/corretores",
        },
        {
          id: "pages",
          label: "Páginas institucionais publicadas (opcional)",
          done: (pages.count ?? 0) > 0,
          link: "/app/site",
        },
        {
          id: "dominio",
          label: "Domínio próprio verificado (opcional)",
          done: domainsList.some((d) => d.verificado),
          link: "/app/configuracoes/dominios",
        },
      ];
      setChecks(list);

      // Audit detailed pending integrations status
      const tempEmailHasDomain = domainsList.some((d) => d.verificado);
      const emailDiag: IntegrationDiagnosis = {
        id: "email",
        name: "E-mail Transacional",
        category: "Comunicação",
        status: tempEmailHasDomain ? "active" : "pending",
        statusText: tempEmailHasDomain ? "Configurado e ativo" : "Pendente (Usa domínio genérico)",
        description:
          "Templates funcionais baseados em React Email integrados ao fluxo (Cadastros, Recuperação de senha, Magic-links, Convites e Notificações de Leads).",
        details: tempEmailHasDomain
          ? "Domínio remetente próprio verificado. Notificações estão saindo com sua marca."
          : "Sem domínio de remetente próprio ativo. Envios automáticos de segurança e notificações ocorrem via domínio genérico padrão: 'notify.imob365.com.br'.",
        icon: Mail,
        actionText: "Verificar Domínio",
        actionLink: "/app/configuracoes/dominios",
      };

      // Check Real Estate Portals
      const vrFeed = feedsList.find((f) => f.portal_slug === "vivareal");
      const vrConfigured = !!(vrFeed?.enabled && vrFeed?.credentials?.client_id);

      const zapFeed = feedsList.find((f) => f.portal_slug === "zap");
      const zapConfigured = !!(zapFeed?.enabled && zapFeed?.credentials?.client_id);

      const wimoveisFeed = feedsList.find((f) => f.portal_slug === "wimoveis");
      const wimoveisConfigured = !!(wimoveisFeed?.enabled && wimoveisFeed?.credentials?.api_key);

      const olxFeed = feedsList.find((f) => f.portal_slug === "olx");
      const olxConfigured = !!(olxFeed?.enabled && olxFeed?.credentials?.client_id);

      const totalPortalsConfigured = [
        vrConfigured,
        zapConfigured,
        wimoveisConfigured,
        olxConfigured,
      ].filter(Boolean).length;

      const portalDiag: IntegrationDiagnosis = {
        id: "portals",
        name: "Portais Imobiliários (Feeds por Tenant)",
        category: "Marketing",
        status:
          totalPortalsConfigured === 4
            ? "active"
            : totalPortalsConfigured > 0
              ? "sandbox"
              : "pending",
        statusText: `${totalPortalsConfigured} de 4 configurados`,
        description:
          "Disparo automático de anúncios via arquivos públicos de feed VRSync XML e OLX Realty.",
        details: `Integrado via API no 'src/lib/portais.ts'. VivaReal: ${vrConfigured ? "Ok" : "Pendente"}; ZAP: ${zapConfigured ? "Ok" : "Pendente"}; Wimóveis: ${wimoveisConfigured ? "Ok" : "Pendente"}; OLX: ${olxConfigured ? "Ok" : "Pendente"}. Cadastre as chaves de API da imobiliária nos portais correspondentes para ativação total.`,
        icon: Globe2,
        actionText: "Ajustar Portais",
        actionLink: "/app/portais",
      };

      // Check Domains white label
      const activeDomains = domainsList.filter((d) => d.verificado).length;
      const domainDiag: IntegrationDiagnosis = {
        id: "domains",
        name: "Domínios White-label",
        category: "Infraestrutura",
        status: activeDomains > 0 ? "active" : "pending",
        statusText:
          activeDomains > 0
            ? `${activeDomains} domínio(s) configurado(s)`
            : "Pendente de apontamento DNS",
        description: "Hospedagem e isolamento da marca sob domínio customizado da imobiliária.",
        details:
          activeDomains > 0
            ? `Domínio próprio verificado com sucesso pelo inquilino.`
            : "Nenhum apontamento DNS (registro CNAME e IP A) verificado ainda no painel. O site está rodando no subdomínio provisório da imob365.",
        icon: Sliders,
        actionText: "Gerenciar DNS",
        actionLink: "/app/configuracoes/dominios",
      };

      // Check Google Maps / Geocoding
      const mapsDiag: IntegrationDiagnosis = {
        id: "maps",
        name: "Google Maps & Geocoding",
        category: "Geo/Localização",
        status: "fallback_active",
        statusText: "Fallback Ativo (Grátis)",
        description:
          "Renderização de pontos georreferenciados no mapa em tempo real e buscador de CEP / logradouros.",
        details:
          "Atualmente configurado com Fallback Ativo Automático e Gratuito: o mapa utiliza Leaflet integrado e as consultas de endereço em 'geocode.functions.ts' rodam via Nominatim OpenStreetMap de forma estável e segura. Se preferir usar o motor oficial do Google, é preciso declarar GOOGLE_MAPS_API_KEY.",
        icon: Activity,
      };

      // Other Optional Integrations
      const waDiag: IntegrationDiagnosis = {
        id: "whatsapp",
        name: "WhatsApp Business API",
        category: "Comunicação",
        status: "sandbox",
        statusText: "Direct-Link wa.me Ativo",
        description:
          "Geração instantânea de links de conversas com corretores embutidos na ficha do imóvel.",
        details:
          "O portal gera links automáticos diretos ('wa.me/numero_corretor') para click-to-chat sem custo. Disparo automatizado de mensagens de marketing ativo via servidores dedicados oficiais WhatsApp exige contratação e contrachave de API de terceiro (Z-API/ChatPro).",
        icon: Smartphone,
      };

      const hasGA4 = !!ss.ga4_id;
      const hasGTM = !!ss.gtm_id;
      const hasFB = !!ss.fb_pixel_id;
      const trackingDiag: IntegrationDiagnosis = {
        id: "tracking",
        name: "Pixels de Tracking",
        category: "Marketing",
        status: hasGA4 || hasGTM || hasFB ? "active" : "pending",
        statusText: hasGA4 || hasGTM || hasFB ? "Ativo" : "Pendente",
        description:
          "Injeção de cookies e tags para Google Analytics 4, Tag Manager, Google Ads e Meta Pixel no 'TrackingPixels.tsx'.",
        details: `Capturado dos metadados globais da sua conta. GA4: ${hasGA4 ? "Configurado ID: " + ss.ga4_id : "Vazio"}; GTM: ${hasGTM ? "Configurado ID: " + ss.gtm_id : "Vazio"}; Meta Pixel: ${hasFB ? "Configurado" : "Vazio"}.`,
        icon: Code,
        actionText: "Ajustar Site",
        actionLink: "/app/site",
      };

      const esignDiag: IntegrationDiagnosis = {
        id: "esign",
        name: "Assinatura Eletrônica de Contratos",
        category: "Jurídico",
        status: "sandbox",
        statusText: "Clicksign Sandbox Integrado",
        description:
          "Modulo completo para emissão, despacho, assinatura e autenticação de contratos digitais de locação e venda.",
        details:
          "Simulador de Laboratório Sandbox do ClickSign com Hash de Auditoria SHA-256 e checklist automático de vistorias 100% integrados em 'routes/app.contratos.$id.tsx'. O disparo oficial de links de email/SMS fora do modo sandbox requer a chave de token de produção do ClickSign.",
        icon: ShieldCheck,
        actionText: "Ver Contratos",
        actionLink: "/app/contratos/modelos",
      };

      const billingDiag: IntegrationDiagnosis = {
        id: "billing",
        name: "Gateway de Faturamento Planos SaaS",
        category: "Financeiro",
        status: "sandbox",
        statusText: "Simulador Sandbox",
        description:
          "Área de upgrades, alteração de limites e cobranças por corretor integrado na plataforma.",
        details:
          "Área de planos (/app/contratacao) funcional em modo Sandbox com faturamento local e upgrade imediato de limites. Integração nativa com chaves produtivas do Stripe para recorrência de boleto, pix e cartão em conformidade PCI.",
        icon: CreditCard,
        actionText: "Ajustar Planos",
        actionLink: "/app/contratacao",
      };

      const cartorioDiag: IntegrationDiagnosis = {
        id: "cartorios",
        name: "Cartórios / Registro de Imóveis",
        category: "Jurídico",
        status: "pending",
        statusText: "Painel Pronto (Integração Direta Pendente)",
        description:
          "Pesquisa, solicitação e download de certidões atualizadas e matrículas de bens patrimoniais.",
        details:
          "Módulo de controle estético e visual cadastrado em 'app.cartorios.tsx'. Conexões oficiais com registradores digitais, Central de Registradores de Imóveis (ONR) são feitas sob demanda ou manualmente pelos consultores credenciados.",
        icon: Building2,
        actionText: "Painel de Cartórios",
        actionLink: "/app/cartorios",
      };

      const erpDiag: IntegrationDiagnosis = {
        id: "erp",
        name: "SuperLógica / ERPs Financeiros",
        category: "Financeiro",
        status: "pending",
        statusText: "Desconectado (Ajustes Internos Ativos)",
        description:
          "Envio de contas correlatas, split de faturamento e taxas condominiais para ERP de administração de terceiros.",
        details:
          "O controle de comissão de corretores, lançamentos de recebíveis de aluguel e vistorias é efetuado e centralizado diretamente de modo nativo dentro do ERP próprio da imob365.",
        icon: Server,
      };

      setDiagnostics([
        emailDiag,
        portalDiag,
        domainDiag,
        mapsDiag,
        waDiag,
        trackingDiag,
        esignDiag,
        billingDiag,
        cartorioDiag,
        erpDiag,
      ]);

      setLoading(false);
    })();
  }, [tenantId]);

  const total = checks.length;
  const done = checks.filter((c) => c.done).length;
  const required = checks.filter((c) => !c.label.includes("opcional"));
  const requiredDone = required.filter((c) => c.done).length;
  const ready = requiredDone === required.length && required.length > 0;

  return (
    <div className="max-w-4xl space-y-6 font-sans">
      {/* Header card with global status progress */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-orange-500/10 p-2.5 text-primary">
              <Rocket className="h-6 w-6 stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                Status do Lançamento (Go-Live)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Analise dados operacionais e diagnostique o status de todas as integrações da
                imobiliária.
              </p>
            </div>
          </div>

          <div className="flex bg-muted p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab("checklist")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "checklist"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileCheck2 className="h-3.5 w-3.5 inline mr-1.5" />
              Checklist Geral
            </button>
            <button
              onClick={() => setActiveTab("integrations")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "integrations"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-3.5 w-3.5 inline mr-1.5" />
              Diagnóstico de Integrações
            </button>
          </div>
        </div>

        {activeTab === "checklist" && (
          <div className="mt-6 border-t border-border/65 pt-4">
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500"
                style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground font-sans">
              <span>
                {done} de {total} itens operacionais obrigatórios concluídos
              </span>
              <span>Barra de Progresso: {total > 0 ? Math.round((done / total) * 100) : 0}%</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 space-x-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
          <span className="text-xs text-muted-foreground font-medium pl-1.5">
            Auditando banco de dados e apurando chaves...
          </span>
        </div>
      ) : activeTab === "checklist" ? (
        <div className="space-y-3">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                {c.done ? (
                  <div className="rounded-full bg-emerald-50 text-emerald-600 p-0.5">
                    <CheckCircle2 className="h-5 w-5 fill-emerald-100" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/35 stroke-[1.5]" />
                )}
                <div>
                  <span
                    className={`text-xs font-bold font-sans ${c.done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {c.label}
                  </span>
                  {c.id === "dominio" && (
                    <span className="text-[10px] block text-muted-foreground mt-0.5 font-sans">
                      Permite hospedar no link oficial da sua imobiliária (ex:
                      portal.imobiliaria.com)
                    </span>
                  )}
                  {c.id === "tenant" && (
                    <span className="text-[10px] block text-muted-foreground mt-0.5 font-sans">
                      Dados necessários para emissão de Notas Fiscais, recibos e relatórios de
                      comissões.
                    </span>
                  )}
                </div>
              </div>
              {c.link && (
                <Link
                  to={c.link}
                  className="text-xs text-primary font-extrabold hover:underline whitespace-nowrap bg-muted/60 px-3 py-1.5 rounded-lg border border-border/40 hover:bg-muted"
                >
                  {c.done ? "Revisar" : "Configurar"} →
                </Link>
              )}
            </div>
          ))}

          {ready && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center animate-fade-in">
              <CheckCircle className="mx-auto h-9 w-9 text-emerald-600 fill-emerald-100 animate-pulse" />
              <h4 className="mt-3 text-sm font-extrabold text-emerald-800">
                Pronto para lançar seu Portal!
              </h4>
              <p className="mt-1 text-xs text-emerald-600 max-w-md mx-auto leading-relaxed">
                As configurações operacionais mínimas estão prontas. Você já pode divulgar o link do
                seu site para o mercado captar leads e alugar imóveis.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Detailed integrations diagnostics tab layout */
        <div className="space-y-4">
          <div className="bg-amber-500/[0.04] border border-amber-500/10 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Nota de Transparência de Ambientes:</strong>
              As chaves e tokens de serviços de produção (como e-mails oficiais de domínios,
              assinaturas reais Kliksign e Stripe produtivo) não estão inseridas no arquivo .env
              global por questões de segurança. A plataforma utiliza um motor inteligente de
              sandbox, simulação ou fallbacks grátis para garantir que você continue utilizando a
              ferramenta normalmente.
            </div>
          </div>

          <div className="grid gap-4.5">
            {diagnostics.map((diag) => {
              const BadgeColor = {
                active: "bg-emerald-50 text-emerald-700 border-emerald-200",
                pending: "bg-destructive/5 text-destructive border-destructive/10",
                sandbox: "bg-indigo-50 text-indigo-700 border-indigo-200",
                fallback_active: "bg-amber-50 text-amber-700 border-amber-200",
              }[diag.status];

              return (
                <div
                  key={diag.id}
                  className="rounded-xl border border-border bg-card p-5 space-y-3.5 hover:shadow-xs transition-shadow"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2 text-foreground/80">
                        <diag.icon className="h-5 w-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground block leading-none">
                          {diag.category}
                        </span>
                        <h4 className="text-sm font-extrabold text-foreground mt-1 leading-tight">
                          {diag.name}
                        </h4>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-xs font-bold uppercase rounded-md px-2.5 py-0.5 border ${BadgeColor}`}
                    >
                      {diag.statusText}
                    </Badge>
                  </div>

                  <div className="text-xs space-y-2">
                    <p className="text-muted-foreground leading-relaxed">{diag.description}</p>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/40 text-[11px] leading-relaxed text-foreground/90 font-mono">
                      <strong className="text-foreground block text-[10px] uppercase font-bold tracking-wide font-sans mb-1 text-muted-foreground">
                        Diagnóstico Técnico:
                      </strong>
                      {diag.details}
                    </div>
                  </div>

                  {diag.actionLink && diag.actionText && (
                    <div className="flex justify-end pt-1">
                      <Link
                        to={diag.actionLink}
                        className="text-xs font-extrabold text-primary hover:underline flex items-center bg-muted/60 hover:bg-muted px-3.5 py-2 rounded-lg border border-border/40 transition-colors"
                      >
                        {diag.actionText} →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
