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
  Chrome, 
  Apple, 
  Instagram, 
  Linkedin,
  Settings2, 
  Info, 
  X, 
  UserCheck, 
  ArrowRight,
  ShieldAlert,
  MenuSquare
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

  // Social Authentication simulation modal
  const [socialModal, setSocialModal] = useState<{ isOpen: boolean; provider: string } | null>(null);
  const [socialEmail, setSocialEmail] = useState("");


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

  async function handleSocialAuth() {
    if (!socialEmail || !socialEmail.includes("@")) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }
    setAuthLoading(true);
    const providerName = socialModal?.provider || "Social";
    setSocialModal(null);

    const mockPassword = "SocialPasswordMock123!";
    const displayName = socialEmail.split("@")[0];

    // Try normal sign-in first
    let result = await supabase.auth.signInWithPassword({
      email: socialEmail,
      password: mockPassword,
    });

    if (result.error) {
      // If sign in fails, simulate sign up
      const signUpResult = await supabase.auth.signUp({
        email: socialEmail,
        password: mockPassword,
        options: {
          data: {
            nome: displayName,
            tipo_usuario: "corretor",
            imobiliaria_nome: displayName + " Negócios",
            aprovado: true,
            pagamento_validado: true,
            pagamento_metodo: "SocialAuth"
          }
        }
      });

      if (signUpResult.error) {
        toast.error(signUpResult.error.message);
        setAuthLoading(false);
        return;
      }

      toast.success(`Conta criada e conectada via ${providerName}!`);
    } else {
      toast.success(`Bem-vindo de volta via ${providerName}!`);
    }

    setAuthLoading(false);
    setIsOpen(false);
    navigate({ to: "/app" });
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
          <ChevronDown className={`h-3 w-3 stroke-[2.2px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
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
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
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
                        Simule parcelas SAC e Price com índices de inflação atualizados e taxas reais.
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
                        Insira seu portfólio de imóveis e anuncie no maior portal imobiliário parceiro em segundos.
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
                        Escolha o pacote perfeito para o seu crescimento como corretor ou imobiliária.
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
                            <Label htmlFor="menu-email" className="text-3xs font-bold text-muted-foreground uppercase">E-mail</Label>
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
                            <Label htmlFor="menu-pass" className="text-3xs font-bold text-muted-foreground uppercase">Senha de acesso</Label>
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
                              <Label htmlFor="menu-reg-name" className="text-3xs font-bold text-muted-foreground uppercase">Seu Nome</Label>
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
                              <Label htmlFor="menu-reg-email" className="text-3xs font-bold text-muted-foreground uppercase">E-mail</Label>
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
                              <Label htmlFor="menu-reg-pass" className="text-3xs font-bold text-muted-foreground uppercase">Criar Senha</Label>
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

                    {/* SOCIAL LOGINS COMPACT */}
                    <div className="pt-3 border-t border-border/50">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                          <span className="bg-background px-2 text-muted-foreground/85 font-semibold font-sans">
                            {authTab === "login" ? "Ou acesse rápido com rede social" : "Ou registre-se com rede social"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="p-1 h-8 w-full flex items-center justify-center cursor-pointer border-border/60 hover:bg-muted/50 rounded-xl"
                          onClick={() => { setSocialModal({ isOpen: true, provider: "Google" }); setSocialEmail(email); }}
                        >
                          <Chrome className="h-4 w-4 text-red-500" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="p-1 h-8 w-full flex items-center justify-center cursor-pointer border-border/60 hover:bg-muted/50 rounded-xl"
                          onClick={() => { setSocialModal({ isOpen: true, provider: "Instagram" }); setSocialEmail(email); }}
                        >
                          <Instagram className="h-4 w-4 text-pink-600" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="p-1 h-8 w-full flex items-center justify-center cursor-pointer border-border/60 hover:bg-muted/50 rounded-xl"
                          onClick={() => { setSocialModal({ isOpen: true, provider: "LinkedIn" }); setSocialEmail(email); }}
                        >
                          <Linkedin className="h-4 w-4 text-blue-700" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="p-1 h-8 w-full flex items-center justify-center cursor-pointer border-border/60 hover:bg-muted/50 rounded-xl"
                          onClick={() => { setSocialModal({ isOpen: true, provider: "Apple" }); setSocialEmail(email); }}
                        >
                          <Apple className="h-4 w-4 text-foreground" />
                        </Button>
                      </div>
                    </div>


                  </div>
                ) : (
                  
                  /* STATE B: AUTHENTICATED USER IN PORTAL */
                  <div className="grid gap-4.5 sm:grid-cols-12">
                    
                    {/* LEFT PANEL: MAIN LINKS */}
                    <div className="sm:col-span-7 space-y-2">
                      <span className="text-3xs font-black uppercase text-muted-foreground tracking-widest block">Atalhos Operacionais</span>
                      
                      {/* PAINEL (APP / HOME) */}
                      <Link 
                        to="/app" 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-xs font-bold text-foreground transition-all border border-transparent hover:border-border/30"
                      >
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <span className="block font-bold">Painel Imobiliário</span>
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">Seus imóveis, leads coletados, CRECI e propostas.</span>
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
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">Definição de canais, domínios, equipe e taxas.</span>
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
                          <span className="text-[9.5px] text-muted-foreground/85 block font-normal leading-normal">Ajuste de cadastro pessoal e segurança securitária.</span>
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
                            <h5 className="text-xs font-bold text-foreground truncate">{nomeExibicao}</h5>
                            <span className="text-[10px] text-muted-foreground truncate block font-mono mt-0.5">{user.email}</span>
                          </div>
                        </div>

                        {/* ROLES BADGES */}
                        <div className="space-y-1">
                          <span className="text-[8px] uppercase tracking-wider text-muted-foreground block font-bold">Papéis do Consórcio</span>
                          <div className="flex flex-wrap gap-1">
                            {roles.length > 0 ? (
                              roles.map((r) => (
                                <Badge key={r} variant="outline" className="text-[9px] font-bold px-1.5 py-0 uppercase bg-blue-50/5 text-primary border-primary/20">
                                  {r}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 uppercase bg-amber-50/10 text-amber-800 border-amber-300">
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

      {/* SOCIALAUTH DIALOG SIMULATOR */}
      {socialModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold tracking-tight mb-2">Continuar com {socialModal.provider}</h3>
            <p className="text-[11px] text-muted-foreground mb-4 leading-normal">
              Insira seu e-mail para conectar sua conta social via credencial simulada do {socialModal.provider}:
            </p>
            
            <div className="space-y-3.5 text-left">
              <div className="space-y-1">
                <Label htmlFor="socialEmail" className="text-3xs font-bold text-muted-foreground uppercase mb-1 block">Seu E-mail</Label>
                <Input 
                  id="socialEmail" 
                  type="email" 
                  value={socialEmail}
                  onChange={(e) => setSocialEmail(e.target.value)}
                  placeholder="nome@social.com" 
                  required 
                  className="text-2xs h-8.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 text-2xs font-bold" onClick={() => setSocialModal(null)}>Cancelar</Button>
                <Button type="button" size="sm" className="flex-1 bg-primary hover:bg-primary/95 text-white text-2xs font-bold" onClick={handleSocialAuth}>Sim, conectar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
