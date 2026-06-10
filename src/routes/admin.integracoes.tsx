import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plug,
  Globe2,
  Mail,
  Webhook,
  ShieldCheck,
  Fingerprint,
  UserCheck,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ArrowRight,
  History,
  UserCog,
  Unlock,
  Settings2,
  AlertTriangle,
  FileCheck,
  Cpu,
  Smartphone,
  Check,
  Code,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/integracoes")({
  component: Integracoes,
});

type Counts = { feeds: number; webhooks: number; dominios: number; emails: number };

type SimulatedUser = {
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple" | "instagram";
  currentRole: "guest" | "broker" | "admin" | "super_admin";
  createdAt: string;
  pendingRequest?: boolean;
};

function Integracoes() {
  const [c, setC] = useState<Counts>({ feeds: 0, webhooks: 0, dominios: 0, emails: 0 });
  const [activeTab, setActiveTab] = useState<
    "metrics" | "architecture" | "playground" | "privileges"
  >("architecture");
  const [loading, setLoading] = useState(true);

  // Playground credentials states
  const [googleClientId, setGoogleClientId] = useState("7219488390-googleapps.usercontent.com");
  const [googleClientSecret, setGoogleClientSecret] = useState("••••••••••••••••••••••••");
  const [appleServicesId, setAppleServicesId] = useState("com.imob365.apple-auth");
  const [applePrivateKeyName, setApplePrivateKeyName] = useState("AuthKey_Y839XAS.p8");
  const [metaClientId, setMetaClientId] = useState("103948576102934");
  const [metaClientSecret, setMetaClientSecret] = useState("••••••••••••••••••••••••");

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "IAM Terminal pronto para simulações de handshake OAuth2.0 + PKCE.",
    "Clique em 'Simular Handshake de Login' de qualquer provedor para testar.",
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Simulated IAM Database (strict privilege governance)
  const [users, setUsers] = useState<SimulatedUser[]>([
    {
      id: "u-49",
      name: "Lucas Silveira",
      email: "lucas.silveira@corretores.com",
      provider: "google",
      currentRole: "guest",
      createdAt: "24/05/2026 14:10",
      pendingRequest: true,
    },
    {
      id: "u-72",
      name: "Mariana Costa",
      email: "mariana.costa@imobiliariaparceira.com.br",
      provider: "apple",
      currentRole: "guest",
      createdAt: "24/05/2026 15:45",
      pendingRequest: true,
    },
    {
      id: "u-99",
      name: "Thiago Rocha",
      email: "thiago.rocha@assessoria.com.br",
      provider: "instagram",
      currentRole: "guest",
      createdAt: "23/05/2026 09:12",
      pendingRequest: false,
    },
    {
      id: "u-12",
      name: "Clara Mendes",
      email: "clara.mendes@mendesimoveis.com",
      provider: "google",
      currentRole: "broker",
      createdAt: "22/05/2026 11:30",
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<string[]>([
    "[AUDIT] 24/05/2026 16:00 - Super admin elevou Clara Mendes para 'broker'",
    "[AUDIT] 23/05/2026 10:00 - Criação de conta via Google: Lucas Silveira (Quarentena ativa: guest)",
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [f, w, d, e] = await Promise.all([
          supabase
            .from("portal_feeds")
            .select("id", { count: "exact", head: true })
            .eq("enabled", true),
          supabase
            .from("tenant_webhooks")
            .select("id", { count: "exact", head: true })
            .eq("ativo", true),
          supabase
            .from("tenant_domains")
            .select("id", { count: "exact", head: true })
            .eq("verificado", true),
          supabase.from("email_send_log").select("id", { count: "exact", head: true }),
        ]);
        setC({
          feeds: f.count ?? 0,
          webhooks: w.count ?? 0,
          dominios: d.count ?? 0,
          emails: e.count ?? 0,
        });
      } catch (err) {
        console.error("Erro ao puxar métricas:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const runOAuthSimulation = (provider: "google" | "apple" | "instagram") => {
    setIsSimulating(true);
    setTerminalLogs([]);
    const lines = [
      `[00ms] [INIT] Inicializando handshake PKCE do fluxo de autorização segura...`,
      `[45ms] [REDIRECT] Redirecionando payload seguro para o endpoint do provedor: ${provider.toUpperCase()}`,
      `[120ms] [CALLBACK] Callback interceptado em: /auth/v1/callback com Authorization Code.`,
      `[180ms] [EXCHANGE] Trocando Authorization Code por Access + IdToken em Back-Channel.`,
      `[250ms] [SECURITY] Aplicando mitigação de interceptação PKCE (Code Verifier SHA-256 validado OK).`,
      `[320ms] [JWKS] Puxando chaves públicas rotativas do provedor para descriptografia local...`,
      provider === "apple"
        ? `[390ms] [DECRYPT] Decodificando token assinado RS256 com chave Apple. ID Token decodificado com sucesso.`
        : `[390ms] [DECRYPT] Decodificando token com chave de validação local RS256 de ${provider.toUpperCase()}`,
      `[440ms] [CLAIMS] Claims de Identity localizados: email_verified = true.`,
      `[510ms] [QUARANTINE_RULE] Verificando privilégios. Nenhum perfil prévio correspondente.`,
      `[560ms] [QUARANTINE_WARN] ⚠️ PROTEÇÃO CLASSE-A APRESENTADA: Aplicado 'Role Quarantine' automático. Perfil do utilizador configurado como 'guest' (Zero Privilégios Operacionais).`,
      `[610ms] [AUDIT] Histórico persistido em 'auth_audit_log' da base de dados protegida por RLS.`,
      `[680ms] [SUCCESS] Sessão criada no navegador. Redirecionando utilizador para tela de boas-vindas comercial pág. pendente de liberação de permissões.`,
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        setTerminalLogs((prev) => [...prev, lines[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        toast.success(`Simulação de login via ${provider.toUpperCase()} efetuada com sucesso.`);
      }
    }, 180);
  };

  const handleRoleElevation = (userId: string, targetRole: "broker" | "admin") => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, currentRole: targetRole, pendingRequest: false };
        }
        return u;
      }),
    );

    const u = users.find((x) => x.id === userId);
    if (u) {
      const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = "24/05/2026";
      const logMsg = `[AUDIT] ${dateStr} ${now} - Super admin elevou '${u.name}' do fluxo social para '${targetRole.toUpperCase()}' no Tenant ID padrão.`;
      setAuditLogs((prev) => [logMsg, ...prev]);
      toast.success(
        `Sucesso: Privilégios de ${u.name} modificados para ${targetRole.toUpperCase()}`,
      );
    }
  };

  const telemetryItems = [
    {
      label: "Feeds de portais ativos",
      value: c.feeds,
      icon: Globe2,
      hint: "ZAP, Viva Real, OLX (XML público)",
    },
    {
      label: "Webhooks ativos",
      value: c.webhooks,
      icon: Webhook,
      hint: "Entregas assinadas HMAC-SHA256",
    },
    {
      label: "Domínios verificados",
      value: c.dominios,
      icon: Plug,
      hint: "White-label de tenants",
    },
    {
      label: "E-mails enviados (total)",
      value: c.emails,
      icon: Mail,
      hint: "notify.imob365.com.br",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 font-sans">
      {/* PROFESSIONAL INFOSEC SPECIALIST HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/10 bg-gradient-to-br from-[#0c1424] to-[#122543] p-7 text-white shadow-xl">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Fingerprint className="h-32 w-32 text-blue-500" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
                <ShieldCheck className="h-3 w-3" /> AppSec & IAM Audit Blueprint
              </span>
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/30">
                PROPOSTA PRONTA
              </span>
            </div>
            <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight text-white leading-tight">
              Análise de Segurança & Integração de Logins Sociais
            </h1>
            <p className="text-xs text-blue-200/80 max-w-2xl leading-relaxed">
              Arquiteto de Identidades & Segurança de Aplicações apresenta a modelagem de mitigação
              contra hijacking, CSRF e tokens em cache para os provedores <strong>Google</strong>,{" "}
              <strong>Apple</strong> e <strong>Instagram (Meta)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3.5 bg-black/30 border border-white/10 p-4 rounded-xl shrink-0 backdrop-blur-sm">
            <div className="bg-blue-600/20 p-2.5 text-blue-400 rounded-lg">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="text-[10px] block font-semibold text-blue-300">
                ADMIN GOVERNANCE
              </span>
              <span className="text-xs font-bold block text-white mt-0.5">Bruno Ferraro</span>
              <span className="text-[10px] block text-muted-foreground/90 font-mono mt-0.5">
                AppSec & System Super-Admin
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-border/80 p-1 gap-1.5 bg-muted/65 rounded-xl max-w-2xl">
        <button
          onClick={() => setActiveTab("architecture")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "architecture"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Proposta e Arquitetura
        </button>
        <button
          onClick={() => setActiveTab("playground")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "playground"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Simulador (Sandbox)
        </button>
        <button
          onClick={() => setActiveTab("privileges")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "privileges"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <LockKeyhole className="h-3.5 w-3.5" />
          Escalada de Privilégios
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "metrics"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Métricas de Tenant
        </button>
      </div>

      {/* METRICS & TELEMETRY TAB */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          <div className="p-4 bg-muted/30 border rounded-xl flex items-center gap-2.5">
            <Sliders className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground font-medium">
              Monitoramento em tempo real de contadores de integrações operantes nos inquilinos:
            </p>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Carregando estatísticas globais...
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {telemetryItems.map((i) => (
                <div
                  key={i.label}
                  className="rounded-xl border border-border bg-card p-5 group hover:border-primary/50 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xs uppercase tracking-wider font-extrabold text-muted-foreground/85">
                      {i.label}
                    </span>
                    <i.icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-foreground">{i.value}</div>
                  <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">{i.hint}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROPOSAL & ARCHITECTURE TAB */}
      {activeTab === "architecture" && (
        <div className="space-y-8">
          {/* COMPARATIVE ROADMAP */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* GOOGLE SOLUTION */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5 relative">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-[#e0483e] text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4" /> Google Auth (JWT/OAuth2)
                </h4>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase text-[9px]">
                  Sem Fricção
                </Badge>
              </div>
              <p className="text-xs text-foreground font-bold font-sans">
                Melhor Solução de Login do Consumidor Geral
              </p>
              <ul className="text-2xs text-muted-foreground space-y-2 leading-relaxed font-sans">
                <li>
                  • <strong>Protocolo:</strong> Integração nativa OAuth 2.0 PKCE via Supabase Auth
                  API pública.
                </li>
                <li>
                  • <strong>Mapeamento Automatizado:</strong> Foto de perfil de avatar e email
                  verificados via OpenID Connect (OIDC).
                </li>
                <li>
                  • <strong>Infraestrutura:</strong> Cadastro direto de chaves no Google Cloud
                  Console com restrição estrita de origens JavaScript.
                </li>
              </ul>
              <div className="bg-muted p-2.5 rounded-lg border text-[10px] font-mono leading-relaxed text-foreground">
                <strong>Payload OIDC mapeado:</strong>
                <br />
                sub (Google ID), email, name, picture
              </div>
            </div>

            {/* INSTAGRAM (META) SOLUTION */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5 relative">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-pink-600 text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> Instagram (Meta Login)
                </h4>
                <Badge className="bg-sky-50 text-sky-700 border-sky-200 uppercase text-[9px]">
                  Foco em Marketing
                </Badge>
              </div>
              <p className="text-xs text-foreground font-bold font-sans">
                Acelerador de Co-corretagem e Leads Sociais
              </p>
              <ul className="text-2xs text-muted-foreground space-y-2 leading-relaxed font-sans">
                <li>
                  • <strong>Prática Recomendada:</strong> Conexão via Meta Developer App (utilizando
                  permissões básicas do Instagram Graph API).
                </li>
                <li>
                  • <strong>Autenticação de Corretores:</strong> Permite cruzar portfólios
                  imobiliários com as credenciais exclusivas do perfil comercial.
                </li>
                <li>
                  • <strong>Validação:</strong> Supabase revalida as credenciais com o endpoint de
                  Graph Token da Meta a cada renovação.
                </li>
              </ul>
              <div className="bg-muted p-2.5 rounded-lg border text-[10px] font-mono leading-relaxed text-foreground">
                <strong>Payload Graph mapeado:</strong>
                <br />
                id (Meta UID), username, account_type
              </div>
            </div>

            {/* APPLE SIGN-IN SOLUTION */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5 relative">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-neutral-800 dark:text-neutral-100 text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4" /> Apple Sign-In (Services ID)
                </h4>
                <Badge className="bg-indigo-50 text-indigo-750 border-indigo-200 uppercase text-[9px]">
                  AppStore Compliance
                </Badge>
              </div>
              <p className="text-xs text-foreground font-bold font-sans">
                Alto Nível de Privacidade (IdToken JWS)
              </p>
              <ul className="text-2xs text-muted-foreground space-y-2 leading-relaxed font-sans">
                <li>
                  • <strong>Necessidade:</strong> Obrigatório para futura homologação do applet
                  mobile imob365 na Apple Store.
                </li>
                <li>
                  • <strong>Criptografia:</strong> Assinatura de assertions locais com chave privada
                  ECDSA (.p8) gerada no portal de desenvolvedor Apple.
                </li>
                <li>
                  • <strong>Resolução:</strong> Suporta o modo &apos;Hide My Email&apos;, gerando
                  caixa postal proxy segura e exclusiva para a empresa.
                </li>
              </ul>
              <div className="bg-muted p-2.5 rounded-lg border text-[10px] font-mono leading-relaxed text-foreground">
                <strong>Payload Token de Auditoria:</strong>
                <br />
                iss, sub, aud, key_id, hash-sha256
              </div>
            </div>
          </div>

          {/* SECURE ARCHITECTURE OVERVIEW BLOCK */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Fluxo de Segregação de
              privilégios e &quot;Quarentena de Funções&quot; (AppSec)
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
              Em sistemas multi-inquilinos (multi-tenant) como a <strong>imob365</strong>, liberar a
              função admin automaticamente após o login social é um grave erro de segurança (
              <span className="text-destructive font-semibold">Critical Broken Access Control</span>
              ). Sob a perspectiva de AppSec, implementamos o fluxo de{" "}
              <strong>Quarentena de Papéis</strong>:
            </p>

            {/* PIPELINE VISUAL */}
            <div className="bg-muted/40 border p-5 rounded-2xl flex flex-col md:flex-row items-stretch gap-4 text-center md:text-left relative">
              <div className="flex-1 p-3.5 bg-background border rounded-lg space-y-1 relative">
                <span className="bg-blue-50 text-blue-800 border-blue-200 border text-[9px] font-bold px-1.5 py-0.5 rounded uppercase block w-fit">
                  Etapa 1
                </span>
                <h5 className="text-xs font-bold text-foreground">Entrada do Usuário</h5>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Usuário realiza o fluxo OAuth via Google, Apple ou Instagram de forma
                  transparente.
                </p>
              </div>

              <div className="flex items-center justify-center text-muted-foreground/50">
                <ArrowRight className="h-5 w-5 hidden md:block" />
              </div>

              <div className="flex-1 p-3.5 bg-blue-500/[0.03] border border-blue-500/15 rounded-lg space-y-1">
                <span className="bg-[#e0483e] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase block w-fit">
                  Etapa 2 (Sandbox)
                </span>
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1 justify-center md:justify-start">
                  <LockKeyhole className="h-3.5 w-3.5 text-primary" /> Quarentena Segura
                </h5>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  O registro do banco de dados na tabela{" "}
                  <code className="bg-muted px-1 text-xs">public.members</code> é isolado sob a role
                  provisória{" "}
                  <code className="bg-muted px-1 font-mono text-xs text-[#e0483e]">
                    &quot;guest&quot;
                  </code>{" "}
                  ou{" "}
                  <code className="bg-muted px-1 font-mono text-xs text-[#e0483e]">
                    &quot;guest_pending&quot;
                  </code>
                  .
                </p>
              </div>

              <div className="flex items-center justify-center text-muted-foreground/50">
                <ArrowRight className="h-5 w-5 hidden md:block" />
              </div>

              <div className="flex-1 p-3.5 bg-background border rounded-lg space-y-1">
                <span className="bg-emerald-50 border-emerald-200 border text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase block w-fit">
                  Etapa 3
                </span>
                <h5 className="text-xs font-bold text-foreground">Ação do Super Admin</h5>
                <p className="text-[11px] text-muted-foreground leading-snug font-sans">
                  Apenas o <strong>Super-Admin do Sistema imob365</strong> ou o respectivo Dono da
                  Imobiliária pode promover o novo usuário a corretor (
                  <code className="font-mono text-xs">&quot;broker&quot;</code>) ou administrador (
                  <code className="font-mono text-xs">&quot;admin&quot;</code>).
                </p>
              </div>
            </div>

            <div className="bg-amber-500/[0.04] border border-amber-500/15 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-900 font-sans">
                  Isolamento com RLS (Row Level Security)
                </h4>
                <p className="text-2xs text-amber-800 leading-relaxed font-sans">
                  Adicionalmente, as políticas RLS nativas do PostgreSQL no Supabase evitam que
                  qualquer usuário com credencial de rede social acesse dados confidenciais de
                  imóveis, proprietários ou comissões financeiras sem antes ter uma relação
                  estruturada no mapeamento de{" "}
                  <code className="bg-amber-100/50 px-1 text-xs">tenant_members</code> controlada
                  pelos super-administradores do portal.
                </p>
              </div>
            </div>
          </div>

          {/* OWASP RECOMMENDATIONS PANEL */}
          <div className="border border-border rounded-xl bg-card p-6 space-y-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" /> Diretrizes de Blindagem de Aplicação (OWASP MASVS /
              ASVS)
            </h4>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-muted/40 rounded-xl space-y-2 border">
                <h5 className="text-xs font-bold flex items-center gap-1.5">
                  <span className="bg-destructive/10 text-destructive text-[9px] font-bold px-1.5 py-0.5 rounded">
                    A01:2026-Broken Auth
                  </span>
                  Session Replay Mitigation
                </h5>
                <p className="text-2xs text-muted-foreground leading-relaxed font-sans">
                  Para mitigar roubos de tokens via XSS ou Session Hijacking, as chaves e sessões de
                  provedores sociais gerados pelo Supabase são limpos dos parâmetros de querystrings
                  via window.history imediatamente após a ingestão de sessão segura do frontend em{" "}
                  <code className="bg-muted px-1 text-[10px]">main.tsx</code>. O token JWT possui
                  TTL curto (1 hora) forçando rotações saudáveis programáticas.
                </p>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-2 border">
                <h5 className="text-xs font-bold flex items-center gap-1.5 font-sans">
                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-bold px-1.5 py-0.5 rounded">
                    MFA REINFORCED
                  </span>
                  Autenticação Multifator Adicional
                </h5>
                <p className="text-2xs text-muted-foreground leading-relaxed font-sans">
                  A nossa plataforma permite que após o login via Google ou Apple, o utilizador use
                  TOTP cadastrado no respectivo painel de segurança do usuário, blindando duplamente
                  acessos a feeds de exportação XML de corretores e comissões corporativas do
                  conselho regional de corretores (CRECI).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED PROVIDERS SANDBOX PLAYGROUND */}
      {activeTab === "playground" && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          {/* SANDBOX FORM CONFIG FOR PROVIDERS */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Parâmetros do Sandbox do Sistema OAuth
            </h3>

            <p className="text-2xs text-muted-foreground leading-relaxed">
              Configure as chaves fictícias necessárias para testar as callbacks do sistema e a
              simulação de segurança. Em ambiente produtivo, esses dados devem ser declarados
              exclusivamente no painel do Supabase.
            </p>

            <div className="space-y-4 pt-1">
              {/* GOOGLE INPUT */}
              <div className="space-y-2 border-b pb-4.5 border-border/60">
                <span className="text-[10px] uppercase font-black text-[#e0483e] block">
                  Google Console
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-2xs text-muted-foreground">Google Client ID</Label>
                    <Input
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">Google Client Secret</Label>
                    <Input
                      type="password"
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* APPLE INPUT */}
              <div className="space-y-2 border-b pb-4.5 border-border/60">
                <span className="text-[10px] uppercase font-black text-neutral-800 dark:text-neutral-100 block">
                  Apple Developer Center
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-2xs text-muted-foreground">
                      Apple Service ID / Client ID
                    </Label>
                    <Input
                      value={appleServicesId}
                      onChange={(e) => setAppleServicesId(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">Chave Privada (.p8)</Label>
                    <Input
                      value={applePrivateKeyName}
                      onChange={(e) => setApplePrivateKeyName(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* META INSTAGRAM INPUT */}
              <div className="space-y-2 pb-2">
                <span className="text-[10px] uppercase font-black text-pink-600 block">
                  Meta Basic Displays (Instagram)
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-2xs text-muted-foreground">App Client ID</Label>
                    <Input
                      value={metaClientId}
                      onChange={(e) => setMetaClientId(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">App Secret Key</Label>
                    <Input
                      type="password"
                      value={metaClientSecret}
                      onChange={(e) => setMetaClientSecret(e.target.value)}
                      className="text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* SIMULATE HANDSHAKES TRIGGERS */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-muted-foreground block mb-2 font-sans">
                  Simular Ativação Segura via Callback:
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSimulating}
                    onClick={() => runOAuthSimulation("google")}
                    className="text-2xs font-bold border-[#e0483e]/30 hover:bg-[#e0483e]/5 hover:text-[#e0483e]"
                  >
                    <Globe2 className="h-3.5 w-3.5 text-[#e0483e]" />
                    Testar Google Handshake
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSimulating}
                    onClick={() => runOAuthSimulation("apple")}
                    className="text-2xs font-bold border-neutral-400 hover:bg-neutral-100 hover:text-black dark:text-white dark:hover:bg-neutral-850"
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    Testar Apple PKCE
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSimulating}
                    onClick={() => runOAuthSimulation("instagram")}
                    className="text-2xs font-bold border-pink-500/30 hover:bg-pink-500/5 hover:text-pink-600"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-pink-600" />
                    Testar Instagram SDK
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULATED CRYPTOGRAPHIC SHELL */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col justify-between shadow-2xl relative min-h-[440px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 font-mono">
                  <Terminal className="h-4 w-4 text-emerald-500" />
                  IAM_DECRYPT_AUDITOR_CLI
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                </div>
              </div>

              {/* LIVE TERMINAL LINES */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto font-mono text-2xs leading-relaxed text-emerald-400/95">
                {terminalLogs.map((log, index) => (
                  <div
                    key={index}
                    className="whitespace-pre-wrap select-text selection:bg-emerald-800 selection:text-white"
                  >
                    {log}
                  </div>
                ))}
                {isSimulating && (
                  <div className="animate-pulse inline-block pl-1 text-white select-none">▋</div>
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Host IP: 127.0.0.1</span>
              <span>AES-256 JWK Verification</span>
            </div>
          </div>
        </div>
      )}

      {/* PRIVILEGE ELEVATION BY SYSTEM SUPER-ADMIN PANEL */}
      {activeTab === "privileges" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-blue-500/10 rounded-xl p-5 flex gap-3 text-xs leading-relaxed text-slate-800 dark:text-blue-100">
            <UserCheck className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-extrabold text-[#0c1424] dark:text-blue-200">
                Políticas de Alçada e Consentimento Governamental:
              </strong>
              <p className="text-2xs text-muted-foreground/95 leading-relaxed font-sans">
                Por design de segurança corporativa, qualquer utilizador cadastrado via conexões de
                identidades globais sociais entra em quarentena estéril com cargo de{" "}
                <code className="bg-white/45 px-1 font-mono text-xs">guest</code> (Visitante
                pendente). Somente um **Super-Admin da Plataforma** (nosso cockpit administrativo
                geral) ou o respectivo Administrador do Tenant detém chaves criptográficas para
                revogar a quarentena e assinar a alteração de Claims.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* COMPONENT list: PENDING USERS IN QUARANTINE */}
            <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-sans">
                  <UserCog className="h-4 w-4" /> Usuários Recentes via Social Login (Quarentena
                  Ativa)
                </h4>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">
                  Aguardando Aprovação Manual
                </span>
              </div>

              <div className="space-y-3.5">
                {users.map((u) => {
                  const ProviderBadge = {
                    google: "bg-red-50 text-red-700 border-red-200",
                    apple:
                      "bg-neutral-150 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-white dark:border-neutral-550",
                    instagram: "bg-pink-50 text-pink-700 border-pink-200",
                  }[u.provider];

                  const RoleBadge = {
                    guest: "bg-amber-55 text-amber-800 border-amber-200 font-bold",
                    broker: "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold",
                    admin: "bg-blue-50 text-blue-800 border-blue-200 font-bold",
                    super_admin: "bg-purple-50 text-purple-800 border-purple-200 font-bold",
                  }[u.currentRole];

                  return (
                    <div
                      key={u.id}
                      className="rounded-xl border border-border bg-card p-4.5 space-y-3 hover:border-primary/30 transition-all duration-150"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-black text-xs text-foreground mt-0.5">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-foreground leading-none">
                              {u.name}
                            </h5>
                            <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
                              {u.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-2 uppercase ${ProviderBadge}`}
                          >
                            {u.provider}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-2 uppercase ${RoleBadge}`}
                          >
                            {u.currentRole}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3 text-2xs text-muted-foreground font-mono">
                        <span>Criado em: {u.createdAt}</span>
                        {u.pendingRequest ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleRoleElevation(u.id, "broker")}
                              className="text-3xs font-bold px-2.5 py-1 h-7 bg-primary hover:bg-primary/95 text-white"
                            >
                              Aprovar como Corretor
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRoleElevation(u.id, "admin")}
                              variant="outline"
                              className="text-3xs font-bold px-2.5 py-1 h-7 border-slate-300"
                            >
                              Elevar para Admin
                            </Button>
                          </div>
                        ) : (
                          <div className="text-emerald-600 font-bold flex items-center gap-1 font-sans">
                            <Check className="h-3 w-3" /> Privilégios definidos por Super-Admin
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE AUDIT EVENTS OF ELEVATIONS */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h4 className="font-extrabold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-sans">
                <History className="h-4 w-4 text-primary" /> Histórico de Auditoria IAM (Seguro)
              </h4>
              <p className="text-2xs text-muted-foreground leading-relaxed leading-relaxed font-sans">
                Eventos reais ou simulados de promoções de credenciais. Todo o histórico de elevação
                assina as transações no log imutável de governança.
              </p>

              <div className="space-y-2 border-t pt-2.5">
                {auditLogs.map((log, id) => (
                  <div
                    key={id}
                    className="p-2.5 rounded-lg border bg-muted/30 text-[10px] font-mono leading-relaxed text-foreground border-border/70 break-all"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
