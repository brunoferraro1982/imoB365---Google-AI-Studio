import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatBadge } from "@/components/chat/ChatBadge";
import {
  Building2,
  Users,
  UserCircle2,
  FileText,
  Banknote,
  Wallet,
  Globe2,
  Settings,
  Mail,
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  Globe,
  Calendar,
  Landmark,
  Building,
  Home,
  CheckSquare,
  LogOut,
  Scale,
  Megaphone,
  FileSignature,
  Link2,
  Flag,
  Gauge,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Item = { to: string; label: string; icon: typeof Building2 };
type Module = { id: string; label: string; icon: typeof Building2; items: Item[] };

const tenantModules: Module[] = [
  {
    id: "imobiliario",
    label: "Imobiliário",
    icon: Building,
    items: [
      { to: "/app", label: "Painel inicial", icon: LayoutDashboard },
      { to: "/app/imoveis", label: "Imóveis", icon: Building2 },
      { to: "/app/empreendimentos", label: "Empreendimentos", icon: Building },
      { to: "/app/locacao", label: "Locação", icon: Home },
      { to: "/app/leads", label: "Clientes & oportunidades", icon: Users },
      { to: "/app/tarefas", label: "Minhas tarefas", icon: CheckSquare },
      { to: "/app/visitas", label: "Agenda de visitas", icon: Calendar },
      { to: "/app/corretores", label: "Corretores", icon: UserCircle2 },
    ],
  },
  {
    id: "juridico",
    label: "Jurídico",
    icon: Scale,
    items: [
      { to: "/app/contratos", label: "Contratos", icon: FileText },
      { to: "/app/contratos/modelos", label: "Modelos de contrato", icon: FileSignature },
      { to: "/app/cartorios", label: "Cartórios", icon: Landmark },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Banknote,
    items: [
      { to: "/app/financeiro", label: "Contas a pagar e receber", icon: Banknote },
      { to: "/app/comissoes", label: "Comissões", icon: Wallet },
      { to: "/app/configuracoes/plano-contas", label: "Plano de contas", icon: FileText },
      { to: "/app/configuracoes/centros-custo", label: "Centros de custo", icon: Building },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Site",
    icon: Megaphone,
    items: [
      { to: "/app/site", label: "Site da imobiliária", icon: Globe },
      { to: "/app/site/blog", label: "Blog & Artigos", icon: FileText },
      { to: "/app/site/widgets", label: "Widgets de Conversão", icon: Sparkles },
      { to: "/app/portais", label: "Anúncios em portais", icon: Globe2 },
      { to: "/app/encurtador", label: "Encurtador & QR Code", icon: Link2 },
      { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: Settings,
    items: [
      { to: "/app/configuracoes", label: "Configurações gerais", icon: Settings },
      { to: "/app/configuracoes/checklist", label: "Checklist de documentos", icon: CheckSquare },
    ],
  },
];

const adminNav: Item[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { to: "/admin/tenants", label: "Imobiliárias", icon: Building2 },
  { to: "/admin/planos", label: "Planos", icon: Banknote },
  { to: "/admin/limites", label: "Limites por plano", icon: Gauge },
  { to: "/admin/modulos", label: "Módulos", icon: Globe2 },
  { to: "/admin/flags", label: "Feature flags", icon: Flag },
  { to: "/admin/integracoes", label: "Integrações", icon: Settings },
  { to: "/admin/emails", label: "E-mails", icon: Mail },
  { to: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
];

export function AppShell({ variant }: { variant: "tenant" | "admin" }) {
  const { user, loading, isSuperAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const router = useRouterState();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && variant === "admin" && !isSuperAdmin) {
      navigate({ to: "/app" });
    }
  }, [user, loading, variant, isSuperAdmin, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const current = router.location.pathname;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  // Pending approval locker gate for non-super admins
  if (!isSuperAdmin && profile && !profile.aprovado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/45 p-6 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <Logo className="h-8 w-auto mx-auto mb-6" />
          <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 stroke-[2.25]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Cadastro em Análise</h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Olá, <span className="font-semibold text-foreground">{profile.nome || user.email}</span>
            ! Sua conta foi criada com sucesso e está aguardando homologação do Administrador Geral
            imob365.
          </p>

          <div className="mt-5 border border-border/80 rounded-xl p-4 bg-muted/20 text-left text-xs space-y-3">
            <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                Identificação
              </span>
              <span className="font-mono text-3xs font-medium">{user.email}</span>
            </div>
            {profile.tipo_usuario && (
              <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                  Perfil
                </span>
                <span className="font-semibold capitalize text-right text-3xs">
                  {profile.tipo_usuario === "imobiliaria"
                    ? "Imobiliária / Agência"
                    : "Corretor de Imóveis"}
                </span>
              </div>
            )}
            {profile.plano_pretendido && (
              <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                  Plano Pretendido
                </span>
                <span className="font-semibold text-right text-3xs">
                  Plano {profile.plano_pretendido}
                </span>
              </div>
            )}
            {profile.imobiliaria_nome && (
              <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                  {profile.tipo_usuario === "corretor"
                    ? "Vínculo de Imobiliária"
                    : "Parceiro Comercial"}
                </span>
                <span className="font-semibold text-right text-3xs truncate max-w-[180px]">
                  {profile.imobiliaria_nome}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                Assinatura
              </span>
              <span
                className={`font-semibold text-right text-3xs ${profile.plano_pretendido === "Free" ? "text-green-600" : "text-amber-600"}`}
              >
                {profile.plano_pretendido === "Free"
                  ? "Grátis (Ativação Direta)"
                  : "Aguardando validação do pagamento"}
              </span>
            </div>
          </div>

          <p className="mt-5 text-balance text-3xs text-muted-foreground leading-normal">
            Seu acesso e visibilidade aos dados do tenant serão ativados assim que o
            super-administrador validar os dados no painel global.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <a href="mailto:contato@imob365.com.br" className="w-full">
              <Button variant="outline" className="w-full h-9 text-xs">
                Contatar Suporte
              </Button>
            </a>
            <Button
              onClick={signOut}
              variant="ghost"
              className="w-full h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              Sair da minha conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <AdminLayout
        items={adminNav}
        current={current}
        email={user.email ?? ""}
        onSignOut={signOut}
      />
    );
  }

  // Tenant: top module bar + filtered sidebar
  const activeModule =
    tenantModules.find((m) =>
      m.items.some((it) =>
        it.to === "/app"
          ? current === "/app"
          : current === it.to || current.startsWith(it.to + "/"),
      ),
    ) ?? tenantModules[0];

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* TOP MODULE BAR */}
      <header className="sticky top-0 z-30 border-b border-sidebar-border/85 bg-sidebar/95 text-sidebar-foreground backdrop-blur-md shadow-sm">
        <div className="flex h-15 items-center gap-6 px-5">
          <Link to="/" className="flex items-center transition-transform hover:scale-[1.02]">
            <Logo className="h-8.5 w-auto" variant="white" />
          </Link>
          <nav className="flex flex-1 items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {tenantModules.map((m) => {
              const active = m.id === activeModule.id;
              const first = m.items[0];
              return (
                <Link
                  key={m.id}
                  to={first.to}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-250 relative ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/20 shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <m.icon
                    className={`h-4 w-4 ${active ? "text-primary stroke-[2.25px]" : "opacity-80"}`}
                  />
                  {m.label}
                  {active && (
                    <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link
                to="/admin"
                className="hidden rounded-full border border-sidebar-border px-3 py-1 text-xs font-semibold tracking-wide text-sidebar-foreground/80 hover:bg-sidebar-accent/80 md:inline-block transition-colors"
              >
                Super-admin
              </Link>
            )}
            <Link
              to="/app/contratacao"
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-bold tracking-wide text-primary hover:bg-primary/25 transition-all select-none duration-250 hover:scale-[1.01]"
            >
              <Sparkles className="h-3 w-3.5 text-primary stroke-[2.5] animate-pulse" />
              <span className="hidden sm:inline-block">Planos & Assinatura</span>
              <span className="sm:hidden">Planos</span>
            </Link>
            <ChatBadge />
            <NotificationBell />
            <ThemeToggle className="text-sidebar-foreground/80 hover:bg-sidebar-accent/60 rounded-full" />
            <div className="hidden truncate text-xs font-medium text-sidebar-foreground/70 md:block max-w-[140px] px-2 py-1 bg-sidebar-accent/40 rounded-md">
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-sidebar-foreground/80 hover:bg-destructive/15 hover:text-destructive-foreground rounded-full transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* SUBMENU LATERAL DO MÓDULO ATIVO */}
        <aside className="hidden w-62 shrink-0 flex-col border-r border-border/80 bg-card/65 backdrop-blur-sm md:flex transition-all duration-300">
          <div className="border-b border-border/70 px-5 py-4.5 bg-muted/10">
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/90">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <activeModule.icon className="h-3.5 w-3.5" />
              </span>
              <span>{activeModule.label}</span>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {activeModule.items.map((item) => {
              const active =
                item.to === "/app"
                  ? current === "/app"
                  : current === item.to ||
                    (current.startsWith(item.to + "/") &&
                      !activeModule.items.some(
                        (sibling) =>
                          sibling.to !== item.to &&
                          sibling.to !== "/app" &&
                          current.startsWith(sibling.to) &&
                          sibling.to.length > item.to.length,
                      ));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                    active
                      ? "bg-primary/10 font-semibold text-primary shadow-xs border-l-3 border-primary pl-2"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <item.icon
                    className={`h-4.5 w-4.5 transition-all duration-200 group-hover:scale-105 ${active ? "text-primary stroke-[2.25px]" : "text-muted-foreground/70"}`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active ? (
                    <ChevronRight className="h-3.5 w-3.5 text-primary opacity-100 translate-x-0 transition-transform" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminLayout({
  items,
  current,
  email,
  onSignOut,
}: {
  items: Item[];
  current: string;
  email: string;
  onSignOut: () => void;
}) {
  // placeholder anchor
  return (
    <div className="flex min-h-screen bg-muted/15">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-3 px-1">
          <Link to="/" className="inline-flex">
            <Logo className="h-9.5 w-auto" variant="white" />
          </Link>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/20 border border-primary/35 px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-primary">
            Super-admin
          </span>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1.5">
          {items.map((item) => {
            const active =
              current === item.to || (item.to !== "/admin" && current.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm transition-all duration-200 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-primary pl-2.5"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon
                  className={`h-4.5 w-4.5 ${active ? "text-primary stroke-[2.25px]" : "opacity-80"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-sidebar-border/80 pt-4">
          <Link
            to="/app"
            className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/65 transition-colors"
          >
            ← Voltar ao app
          </Link>
          <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 bg-sidebar-accent/30 rounded-lg">
            <div className="truncate text-xs text-sidebar-foreground/65 font-mono max-w-[140px]">
              {email}
            </div>
            <NotificationBell />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-destructive/15 hover:text-destructive-foreground rounded-lg transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
