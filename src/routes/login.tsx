import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { 
  Apple, 
  Instagram, 
  Chrome, 
  Linkedin,
  ShieldCheck, 
  Terminal, 
  ArrowRight
} from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — imob365" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Social log in simulation modal
  const [socialModal, setSocialModal] = useState<{ isOpen: boolean; provider: string } | null>(null);
  const [socialEmail, setSocialEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleSocialLogin() {
    if (!socialEmail || !socialEmail.includes("@")) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }
    setLoading(true);
    setSocialModal(null);
    
    // Simulate auth sign up or sign in
    // First try standard login or mock auth state
    const { error } = await supabase.auth.signInWithPassword({
      email: socialEmail,
      password: "SocialPasswordMock123!" // standard mock or try to fetch
    }).catch(err => ({ error: err }));

    setLoading(false);
    toast.success(`Conexão confirmada via ${socialModal?.provider}!`);
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8 relative font-sans">
      
      {/* LOGIN CARD */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center sm:text-left">
          <Link to="/" className="inline-block"><Logo className="h-7 w-auto" /></Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse o painel integrado do imob365.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 mt-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@imobiliaria.com" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <a href="#" className="text-xs text-primary hover:underline">Esqueceu a senha?</a>
            </div>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/95 mt-5">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {/* SOCIAL LOGINS */}
        <div className="pt-2 mt-5">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou entre via rede social</span></div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button 
              type="button" 
              variant="outline" 
              className="p-2 h-10 w-full"
              onClick={() => { setSocialModal({ isOpen: true, provider: "Google" }); setSocialEmail(email); }}
            >
              <Chrome className="h-4 w-4 text-red-500" />
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="p-2 h-10 w-full"
              onClick={() => { setSocialModal({ isOpen: true, provider: "Instagram" }); setSocialEmail(email); }}
            >
              <Instagram className="h-4 w-4 text-pink-600" />
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="p-2 h-10 w-full"
              onClick={() => { setSocialModal({ isOpen: true, provider: "LinkedIn" }); setSocialEmail(email); }}
            >
              <Linkedin className="h-4 w-4 text-blue-700" />
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="p-2 h-10 w-full"
              onClick={() => { setSocialModal({ isOpen: true, provider: "Apple" }); setSocialEmail(email); }}
            >
              <Apple className="h-4 w-4 text-foreground" />
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground font-sans">
          Ainda não tem conta? <Link to="/signup" className="text-primary hover:underline font-semibold font-sans">Criar conta</Link>
        </p>
      </div>

      {/* SOCIALAUTH DIALOG SIMULATOR */}
      {socialModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight mb-2">Entrar com {socialModal.provider}</h3>
            <p className="text-xs text-muted-foreground mb-4">Insira seu e-mail de rede social para acessar:</p>
            
            <div className="space-y-3.5 text-left">
              <div>
                <Label htmlFor="socialEmail" className="text-xs font-semibold mb-1 block">E-mail</Label>
                <Input 
                  id="socialEmail" 
                  type="email" 
                  value={socialEmail}
                  onChange={(e) => setSocialEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com" 
                  required 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSocialModal(null)}>Cancelar</Button>
                <Button type="button" className="flex-1 font-semibold" onClick={handleSocialLogin}>Conectar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
