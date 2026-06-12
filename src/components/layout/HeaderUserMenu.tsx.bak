import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  LogOut,
  LayoutDashboard,
  Heart,
  Bookmark,
  User,
  PlusCircle,
  ChevronDown,
  Lock,
  Sparkles,
  ShieldCheck,
  Calculator,
  Globe2,
  FileCheck,
  Terminal,
  Apple,
  Instagram,
  Linkedin,
  Settings2,
  Info,
  X,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  MenuSquare,
} from "lucide-react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

function initials(nome: string | null | undefined, email: string | null | undefined) {
  const base = (nome && nome.trim()) || (email ?? "");
  if (!base) return "U";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function HeaderUserMenu() {
  const { user, profile, roles, loading } = useAuth();
  const navigate = useNavigate();

  // Menu visibility states
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Authentication forms states
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [authLoading, setAuthLoading] = useState(false);



  // Close mega menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close mega menu on ESC key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-muted" />;
  }

  // Handle credentials login submission inside the mega menu
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta ao portal imob365!");
    setIsOpen(false);
    navigate({ to: "/app" });
  }

  // Handle credentials signup submission inside the mega menu
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    const redirectUrl = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nome },
      },
    });
    setAuthLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta imobiliária criada! Verifique seu e-mail para confirmar.");
    setAuthTab("login");
  }

  async function handleOAuthLogin(
    provider: "google" | "apple" | "linkedin_oidc" | "facebook",
  ) {
    const providerLabel =
      provider === "linkedin_oidc" ? "LinkedIn"
      : provider === "facebook" ? "Instagram"
      : provider.charAt(0).toUpperCase() + provider.slice(1);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setAuthLoading(false);
    if (error) {
      toast.error(`Erro ao conectar com ${providerLabel}: ${error.message}`);
    }
  }

    async function handleSignOut() {
    await supabase.auth.signOut();
    setIsOpen(false);
    toast.success("Desconectado com sucesso.");
    navigate({ to: "/" });
  }

  const nomeExibicao = profile?.nome ?? user?.email ?? "Seja bem-vindo";
  const avatar = profile?.avatar_url ?? (user?.user_metadata as any)?.avatar_url ?? null;

  return (
    <div className="relative font-sans" ref={menuRef}>
      {/* TRIGGER BUTTON (Unified trigger for both states) */}
      {!user ? (
        <button
          id="btn-login-megamenu-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm ${
            isOpen
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/80 bg-card text-foreground/90 hover:border-primary/45 hover:text-primary hover:bg-muted/30"
          }`}
        >
          <Lock className="h-3.5 w-3.5 stroke-[2.2px]" />
          <span>Acessar Portal</span>
          <ChevronDown
            className={`h-3 w-3 stroke-[2.2px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <button
          id="btn-user-megamenu-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 rounded-full border pl-1.5 pr-3 py-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
            isOpen
              ? "border-primary bg-primary/5 ring-1 ring-primary/25"
              : "border-border/85 bg-card/90 hover:bg-muted/70 hover:border-primary/25"
          }`}
        >
          <Avatar className="h-6.5 w-6.5 ring-2 ring-primary/10">
            {avatar && <AvatarImage src={avatar} alt={nomeExibicao} />}
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
              {initials(profile?.nome, user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-xs font-bold tracking-tight text-foreground md:inline">
            {profile?.nome ?? user.email?.split("@")[0] ?? "Minha Conta"}
          </span>
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {/* UNIFIED MEGA MENU DROPDOWN PORTAL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="megamenu-dropdown-portal"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-[90vw] sm:w-[500px] md:w-[760px] max-w-[820px] rounded-2xl border border-border/80 bg-background/98 p-6 shadow-2xl backdrop-blur-md"
          >
            {/* GRID COLUMNS */}
            <div className="grid gap-6 md:grid-cols-12">
              {/* LEFT COLUMN: PUBLIC INTEGRATIONS AND UTILITIES (Always readable in both sessions) */}
              <div className="md:col-span-12 lg:col-span-5 space-y-4 border-b pb-5 md:border-b-0 md:pb-0 lg:border-r lg:pr-5 border-border/60">
                <div className="space-y-1">
                  <span className="bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                    Central Imob365
                  </span>
                  <h4 className="text-xs font-extrabold text-foreground mt-1.5 flex items-center gap-1 font-sans">
                    Área de Serviços
                  </h4>
                  <p className="text-[10px] text-muted-foreground/90 font-sans leading-relaxed">
                    Acesse simulações, planos de assinatura e nosso catálogo de imóveis ativos.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {/* CALCULATORS */}
                  <Link
                    to="/calculadoras"
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/70 transition-all group border border-transparent hover:border-border/40"
                  >
                    <div className="bg-blue-500/10 text-blue-500 p-1.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                      <Calculator className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors block font-sans">
                        Calculadoras de Financiamento
                      </span>
                      <span className="text-[9.5px] text-muted-foreground/80 leading-normal block font-sans">
                        Simule parcelas SAC e Price com índices de inflação atualizados e taxas
                        reais.
                      </span>
                    </div>
                  </Link>

                  {/* ANNOUNCE PROPERTY */}
                  <Link
                    to={user ? "/app" : "/signup"}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/70 transition-all group border border-transparent hover:border-border/40"
                  >
                    <div className="bg-emerald-500/10 text-emerald-600 p-1.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                      <PlusCircle className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors block font-sans">
                        Quero Anunciar Grátis
                      </span>
                      <span className="text-[9.5px] text-muted-foreground/80 leading-normal block font-sans">
                        Insira seu portfólio de imóveis e anuncie no maior portal imobiliário
                        parceiro em segundos.
                      </span>
                    </div>
                  </Link>

                  {/* EXPLORAR IMÓVEIS */}
                  <Link
                    to="/buscar"
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/70 transition-all group border border-transparent hover:border-border/40"
                  >
                    <div className="bg-purple-500/10 text-purple-600 p-1.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors block font-sans">
                        Encontrar Imóveis
                      </span>
                      <span className="text-[9.5px] text-muted-foreground/80 leading-normal block font-sans">
                        Pesquise casas, apartamentos e terrenos prontos para morar ou investir.
                      </span>
                    </div>
                  </Link>

                  {/* PLANOS E ASSINATURAS */}
                  <Link
                    to="/planos"
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/70 transition-all group border border-transparent hover:border-border/40"
                  >
                    <div className="bg-amber-500/10 text-amber-600 p-1.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors block font-sans">
                        Nossos Planos Starter & Pro
                      </span>
                      <span className="text-[9.5px] text-muted-foreground/80 leading-normal block font-sans">
                        Escolha o pacote perfeito para o seu crescimento como corretor ou
                        imobiliária.
                      </span>
                    </div>
                  </Link>
                </div>
              </div>

              {/* RIGHT COLUMN: STATE DRIVEN SPACE (MD: 7/12 cols) */}
              <div className="md:col-span-12 lg:col-span-7 space-y-4">
                {/* STATE A: NOT AUTHENTICATED USER (Embedded Form + Social simulators inside the mega menu) */}
                {!user ? (
                  <div className="space-y-3.5">
                    {/* Inline Tab selectors */}
                    <div className="flex border-b border-border p-0.5 bg-muted/60 rounded-lg">
                      <button
                        onClick={() => setAuthTab("login")}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-extrabold transition-all text-center uppercase cursor-pointer tracking-wider ${
                          authTab === "login"
                            ? "bg-background text-foreground shadow-2xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Login
                      </button>
                      <button
                        onClick={() => setAuthTab("signup")}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-extrabold transition-all text-center uppercase cursor-pointer tracking-wider ${
                          authTab === "signup"
                            ? "bg-background text-foreground shadow-2xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Criar conta
                      </button>
                    </div>

                    {authTab === "login" ? (
                      <form onSubmit={handleLogin} className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor="menu-email"
                              className="text-3xs font-bold text-muted-foreground uppercase"
                            >
                              E-mail
                            </Label>
                            <Input
                              id="menu-email"
                              type="email"
                              placeholder="exemplo@imob365.com"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="text-2xs h-8.5"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="menu-pass"
                              className="text-3xs font-bold text-muted-foreground uppercase"
                            >
                              Senha de acesso
                            </Label>
                            <Input
                              id="menu-pass"
                              type="password"
                              placeholder="Sua senha secreta"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="text-2xs h-8.5"
                            />
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={authLoading}
                          className="w-full text-xs font-bold h-8.5 bg-primary hover:bg-primary/95 text-white"
                        >
                          {authLoading ? "Autenticando..." : "Login"}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleSignup} className="space-y-3">
                        <div className="space-y-2">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="space-y-1 sm:col-span-1">
                              <Label
                                htmlFor="menu-reg-name"
                                className="text-3xs font-bold text-muted-foreground uppercase"
                              >
                                Seu Nome
                              </Label>
                              <Input
                                id="menu-reg-name"
                                placeholder="Nome"
                                required
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                className="text-2xs h-8.5"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-1">
                              <Label
                                htmlFor="menu-reg-email"
                                className="text-3xs font-bold text-muted-foreground uppercase"
                              >
                                E-mail
                              </Label>
                              <Input
                                id="menu-reg-email"
                                type="email"
                                placeholder="exemplo@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="text-2xs h-8.5"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-1">
                              <Label
                                htmlFor="menu-reg-pass"
                                className="text-3xs font-bold text-muted-foreground uppercase"
                              >
                                Criar Senha
                              </Label>
                              <Input
                                id="menu-reg-pass"
                                type="password"
                                minLength={8}
                                placeholder="Mínimo 8 dígitos"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="text-2xs h-8.5"
                              />
                            </div>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={authLoading}
                          className="w-full text-xs font-bold h-8.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {authLoading ? "Enviando registro..." : "Efetuar Cadastro"}
                        </Button>
                      </form>
                    )}

                    {/* SOCIAL LOGINS — Real OAuth */}
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-2">
                        Ou acesse com
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {/* Google */}
                        <button
                          type="button"
                          onClick={() => handleOAuthLogin("google")}
                          disabled={authLoading}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-muted/40 transition-all group disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span className="text-[8px] font-bold text-muted-foreground group-hover:text-foreground">Google</span>
                        </button>
                        {/* Apple */}
                        <button
                          type="button"
                          onClick={() => handleOAuthLogin("apple")}
                          disabled={authLoading}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-muted/40 transition-all group disabled:opacity-50"
                        >
                          <Apple className="h-4 w-4" />
                          <span className="text-[8px] font-bold text-muted-foreground group-hover:text-foreground">Apple</span>
                        </button>
                        {/* LinkedIn */}
                        <button
                          type="button"
                          onClick={() => handleOAuthLogin("linkedin_oidc")}
                          disabled={authLoading}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-muted/40 transition-all group disabled:opacity-50"
                        >
                          <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                          <span className="text-[8px] font-bold text-muted-foreground group-hover:text-foreground">LinkedIn</span>
                        </button>
                        {/* Instagram (via Meta/Facebook OAuth) */}
                        <button
                          type="button"
                          onClick={() => handleOAuthLogin("facebook")}
                          disabled={authLoading}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-muted/40 transition-all group disabled:opacity-50"
                        >
                          <Instagram className="h-4 w-4 text-[#E1306C]" />
                          <span className="text-[8px] font-bold text-muted-foreground group-hover:text-foreground">Instagram</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STATE B: AUTHENTICATED USER IN PORTAL */
                  <div className="grid gap-4.5 sm:grid-cols-12">
                    {/* LEFT PANEL: MAIN LINKS */}
                    <div className="sm:col-span-7 space-y-2">
                      <span className="text-3xs font-black uppercase text-muted-foreground tracking-widest block">
                        Atalhos Operacionais
                      </span>

                      {/* PAINEL (APP / HOME) */}
                      <Link
                        to="/app"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-bold text-foreground transition-all border border-transparent hover:border-border/30"
                      >
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <span className="block font-bold">Painel Imobiliário</span>
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">
                            Seus imóveis, leads coletados, CRECI e propostas.
                          </span>
                        </div>
                      </Link>

                      {/* CONFIGS */}
                      <Link
                        to="/app/configuracoes"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-bold text-foreground transition-all border border-transparent hover:border-border/30"
                      >
                        <Settings2 className="h-4 w-4 text-slate-600" />
                        <div className="flex-1">
                          <span className="block font-bold">Configurar Sistema</span>
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">
                            Definição de canais, domínios, equipe e taxas.
                          </span>
                        </div>
                      </Link>

                      {/* MINHA CONTA */}
                      <Link
                        to="/conta"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-bold text-foreground transition-all border border-transparent hover:border-border/30"
                      >
                        <User className="h-4 w-4 text-emerald-600" />
                        <div className="flex-1">
                          <span className="block font-bold">Perfil & Perfil Geral</span>
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">
                            Ajuste de cadastro pessoal e segurança securitária.
                          </span>
                        </div>
                      </Link>

                      {/* MEUS FAVORITOS */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/65">
                        <Link
                          to="/conta/favoritos"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-2xs font-extrabold text-foreground"
                        >
                          <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-55 animate-pulse" />
                          <span>Meus Favoritos</span>
                        </Link>
                        <Link
                          to="/conta/buscas"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-2xs font-extrabold text-foreground"
                        >
                          <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                          <span>Minhas Buscas</span>
                        </Link>
                      </div>
                    </div>

                    {/* RIGHT CARD: GLASSMORPHIC PROFILE OVERVIEW */}
                    <div className="sm:col-span-5 bg-muted/60 p-4 rounded-xl border border-border/80 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                            {avatar && <AvatarImage src={avatar} alt={nomeExibicao} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {initials(profile?.nome, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-foreground truncate">
                              {nomeExibicao}
                            </h5>
                            <span className="text-[10px] text-muted-foreground truncate block font-mono mt-0.5">
                              {user.email}
                            </span>
                          </div>
                        </div>

                        {/* ROLES BADGES */}
                        <div className="space-y-1">
                          <span className="text-[8px] uppercase tracking-wider text-muted-foreground block font-bold">
                            Papéis do Consórcio
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {roles.length > 0 ? (
                              roles.map((r) => (
                                <Badge
                                  key={r}
                                  variant="outline"
                                  className="text-[9px] font-bold px-1.5 py-0 uppercase bg-blue-50/5 text-primary border-primary/20"
                                >
                                  {r}
                                </Badge>
                              ))
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-bold px-1.5 py-0 uppercase bg-amber-50/10 text-amber-800 border-amber-300"
                              >
                                Guest / Quarentena
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-border/80 pt-3">
                        <Link
                          to="/app/imoveis/novo"
                          onClick={() => setIsOpen(false)}
                          className="w-full"
                        >
                          <Button
                            size="sm"
                            className="w-full rounded-lg font-bold text-2xs h-8.5 bg-gradient-to-r from-primary via-[#e86620] to-orange-500 text-white shadow-sm hover:scale-103 transition-transform"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>Anunciar novo imóvel</span>
                          </Button>
                        </Link>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSignOut}
                          className="w-full text-destructive hover:bg-red-50 hover:text-destructive h-8.5 text-2xs font-extrabold flex items-center justify-center gap-1.5"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Desconectar Conta</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
