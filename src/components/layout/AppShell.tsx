import { Link, Outlet, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPendingMfaFactorId } from "@/lib/mfaGate";
import { ChatBadge, ChatUnreadBadge } from "@/components/chat/ChatBadge";
import { ApprovalsNavBadge } from "@/components/admin/ApprovalsNavBadge";
import { FaturamentoNavBadge } from "@/components/admin/FaturamentoNavBadge";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { BottomNav } from "@/components/layout/BottomNav";
import { ModuleSubNav } from "@/components/layout/ModuleSubNav";
import { AppRail } from "@/components/layout/AppRail";
import { AppSubMenu, SUBMENU_ABERTO_KEY } from "@/components/layout/AppSubMenu";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { TemaSelector } from "@/components/layout/TemaSelector";
import {
  activeSection,
  adminGroups,
  modulosVisiveis,
  isItemActive,
  tenantModules,
  type Item,
} from "@/components/layout/navConfig";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function AppShell({ variant }: { variant: "tenant" | "admin" }) {
  const { user, loading, isSuperAdmin, profile, roles, tenantId, enabledModules = [] } = useAuth();
  // Detectar redirect de acesso negado
  const searchParams = useSearch({ strict: false }) as { forbidden?: string };
  const showForbidden = searchParams.forbidden === "1";
  const navigate = useNavigate();
  const router = useRouterState();
  const [mfaGate, setMfaGate] = useState<"checking" | "ok" | "pending">("checking");
  // Submenu recolhível (desktop). Preferência salva no navegador.
  const [submenuAberto, setSubmenuAberto] = useState(
    () => typeof window === "undefined" || localStorage.getItem(SUBMENU_ABERTO_KEY) !== "0",
  );
  useEffect(() => {
    localStorage.setItem(SUBMENU_ABERTO_KEY, submenuAberto ? "1" : "0");
  }, [submenuAberto]);

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

  useEffect(() => {
    if (!loading && user && profile && !isSuperAdmin && !profile.tipo_usuario) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, profile, isSuperAdmin, navigate]);

  // Cliente final (comprador/locatário) nunca tem tenant — deixá-lo cair em
  // /app quebraria silenciosamente em queries que assumem tenantId. A área
  // dele é /conta; virar profissional é opt-in via "Anunciar Imóvel" →
  // /onboarding, não uma variação de /app.
  useEffect(() => {
    if (
      !loading &&
      user &&
      profile &&
      !isSuperAdmin &&
      profile.tipo_usuario === "cliente" &&
      !tenantId
    ) {
      navigate({ to: "/conta", replace: true });
    }
  }, [loading, user, profile, isSuperAdmin, tenantId, navigate]);

  // Achado de segurança de 2026-07-24: MFA era exigido só na tela de login,
  // não na sessão em si — uma sessão aal1 (senha, sem o desafio TOTP) já
  // liberava acesso direto a qualquer rota de /app ou /admin. Este é o
  // gate real: qualquer entrada na área autenticada checa a sessão atual,
  // não só o formulário de login que a originou.
  useEffect(() => {
    if (loading || !user) {
      setMfaGate("checking");
      return;
    }
    let cancelled = false;
    getPendingMfaFactorId()
      .then((factorId) => {
        if (cancelled) return;
        if (factorId) {
          setMfaGate("pending");
          navigate({ to: "/login" });
        } else {
          setMfaGate("ok");
        }
      })
      .catch((err) => {
        // Acha real de 2026-07-25: sem catch aqui, uma falha nessa checagem
        // (rede, RLS, o que for) deixava a página travada em "Carregando..."
        // pra sempre — bloqueando TODO usuário, não só quem tem MFA. O gate
        // de MFA é uma camada extra de segurança, não a principal (RLS
        // continua sendo); numa falha inesperada, libera o acesso em vez de
        // travar o app inteiro.
        console.error("[AppShell] Falha ao checar MFA pendente, liberando acesso:", err);
        if (!cancelled) setMfaGate("ok");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate]);

  if (loading || !user || mfaGate !== "ok") {
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
              <span className="font-mono text-[10px] font-medium">{user.email}</span>
            </div>
            {profile.tipo_usuario && (
              <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                  Perfil
                </span>
                <span className="font-semibold capitalize text-right text-[10px]">
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
                <span className="font-semibold text-right text-[10px]">
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
                <span className="font-semibold text-right text-[10px] truncate max-w-[180px]">
                  {profile.imobiliaria_nome}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase font-sans tracking-wider text-[10px] font-semibold">
                Assinatura
              </span>
              <span
                className={`font-semibold text-right text-[10px] ${profile.plano_pretendido === "Free" ? "text-green-600" : "text-amber-600"}`}
              >
                {profile.plano_pretendido === "Free"
                  ? "Grátis (Ativação Direta)"
                  : "Aguardando validação do pagamento"}
              </span>
            </div>
          </div>

          <p className="mt-5 text-balance text-[10px] text-muted-foreground leading-normal">
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
    return <AdminLayout current={current} email={user.email ?? ""} onSignOut={signOut} />;
  }

  // Tenant: trilho de módulos (vertical) + submenu + barra utilitária.
  // Visibilidade por papel (Guard 1) e plano (Guard 2), na mesma regra do painel inicial.
  const visibleModules = modulosVisiveis({ roles, enabledModules, isSuperAdmin });

  // Módulo ativo pelo caminho. Em /app é o Início (item "Dashboards").
  const activeModule = activeSection(tenantModules, current) ?? tenantModules[0];
  const itemAtual = activeModule.items.find((it) => isItemActive(it, activeModule.items, current));

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AppRail
        sections={visibleModules.map((m) => ({
          id: m.id,
          label: m.label,
          curto: m.curto,
          icon: m.icon,
          items: m.items,
          destaque: m.destaque,
          badge: m.id === "chat" ? <ChatUnreadBadge /> : undefined,
        }))}
        activeId={activeModule?.id}
        ariaLabel="Módulos"
        footer={
          <>
            <Link
              to="/"
              className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
            >
              ← Site
            </Link>
            {isSuperAdmin && (
              <Link
                to="/admin"
                className="rounded-lg px-2 py-1 text-center text-[10px] font-semibold text-primary hover:bg-sidebar-accent/60"
              >
                Super-admin
              </Link>
            )}
          </>
        }
      />
      {activeModule && (
        <AppSubMenu
          title={activeModule.label}
          icon={activeModule.icon}
          items={activeModule.items}
          current={current}
          aberto={submenuAberto}
          onToggle={() => setSubmenuAberto((v) => !v)}
          ariaLabel={`Menu de ${activeModule.label}`}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar
          trilha={activeModule ? [activeModule.label, ...(itemAtual ? [itemAtual.label] : [])] : []}
          actions={
            <>
              <ChatBadge />
            </>
          }
          email={user.email ?? ""}
          isSuperAdmin={isSuperAdmin}
          onSignOut={signOut}
        />
        {/* Abaixo de lg: sub-páginas do módulo ativo em dropdown (sticky sob a barra utilitária). */}
        {activeModule && <ModuleSubNav items={activeModule.items} current={current} />}
        <main className="min-w-0 flex-1 overflow-x-hidden pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav modules={visibleModules} />
    </div>
  );
}

/** Rótulo do badge por item (contagens do super-admin). */
const badgeAdmin = (item: Item) =>
  item.label === "Aprovações" ? (
    <ApprovalsNavBadge />
  ) : item.label === "Faturamento" ? (
    <FaturamentoNavBadge />
  ) : null;

function AdminLayout({
  current,
  email,
  onSignOut,
}: {
  current: string;
  email: string;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenuAberto, setSubmenuAberto] = useState(
    () => typeof window === "undefined" || localStorage.getItem(SUBMENU_ABERTO_KEY) !== "0",
  );
  useEffect(() => {
    localStorage.setItem(SUBMENU_ABERTO_KEY, submenuAberto ? "1" : "0");
  }, [submenuAberto]);
  const grupoAtivo = activeSection(adminGroups, current) ?? adminGroups[0];
  const itemAtual = grupoAtivo.items.find((it) => isItemActive(it, grupoAtivo.items, current));
  return (
    <div className="flex min-h-screen bg-muted/20">
      <AppRail
        sections={adminGroups.map((g) => ({
          id: g.id,
          label: g.label,
          curto: g.curto,
          icon: g.icon,
          items: g.items,
        }))}
        activeId={grupoAtivo.id}
        ariaLabel="Super-admin"
        footer={
          <Link
            to="/app"
            className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
          >
            ← App
          </Link>
        }
      />
      <AppSubMenu
        title={grupoAtivo.label}
        icon={grupoAtivo.icon}
        items={grupoAtivo.items}
        current={current}
        aberto={submenuAberto}
        onToggle={() => setSubmenuAberto((v) => !v)}
        ariaLabel={`Menu de ${grupoAtivo.label}`}
        renderBadge={badgeAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Abaixo de lg: top bar própria do admin, com o menu completo no Sheet. */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground lg:hidden print:hidden">
          <Link to="/" className="inline-flex shrink-0">
            <Logo className="h-7 w-auto" variant="white" />
          </Link>
          <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-primary/35 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Super-admin
          </span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Menu do admin"
                  className="rounded-full text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[300px] flex-col bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetHeader className="border-b border-sidebar-border/70 px-5 py-4 text-left">
                  <SheetTitle className="text-sidebar-foreground">Super-admin</SheetTitle>
                </SheetHeader>
                <nav
                  aria-label="Menu do super-admin"
                  className="flex flex-1 flex-col gap-4 overflow-y-auto p-3"
                >
                  {adminGroups.map((g) => (
                    <div key={g.id} className="flex flex-col gap-1">
                      <span className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
                        {g.label}
                      </span>
                      {g.items.map((item) => {
                        const ativo = isItemActive(item, g.items, current);
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                              ativo
                                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                            }`}
                          >
                            <item.icon
                              className={`h-4 w-4 ${ativo ? "text-primary stroke-[2.25px]" : "opacity-80"}`}
                            />
                            {item.label}
                            {badgeAdmin(item)}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>
                <div className="space-y-3 border-t border-sidebar-border/70 p-3">
                  <TemaSelector />
                  <Link
                    to="/app"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/65"
                  >
                    ← Voltar ao app
                  </Link>
                  <div className="truncate px-3 font-mono text-xs text-sidebar-foreground/60">
                    {email}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSignOut}
                    className="w-full justify-start rounded-lg text-sidebar-foreground/80 hover:bg-destructive/15 hover:text-destructive-foreground"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <div className="hidden lg:block">
          <AppTopBar
            trilha={[grupoAtivo.label, ...(itemAtual ? [itemAtual.label] : [])]}
            email={email}
            isSuperAdmin
            onSignOut={onSignOut}
          />
        </div>
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
