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
  ShieldCheck, 
  Fingerprint, 
  LockKeyhole, 
  Terminal, 
  UserCheck, 
  X,
  Info
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
  
  // AppSec Handshake Simulator states
  const [showSandbox, setShowSandbox] = useState(false);
  const [activeProvider, setActiveProvider] = useState<"google" | "apple" | "instagram" | null>(null);
  const [sandboxStep, setSandboxStep] = useState(0);
  const [handshakeLogs, setHandshakeLogs] = useState<string[]>([]);

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

  // Triggers the Secure Identity simulation mode
  const triggerSocialLogin = async (provider: "google" | "apple" | "instagram") => {
    setActiveProvider(provider);
    setSandboxStep(0);
    setShowSandbox(true);
    setHandshakeLogs([
      `[INIT] Inicializando flow OAuth 2.0 + PKCE para o provedor: ${provider.toUpperCase()}`,
      `[PKCE] Gerando Code Verifier e Code Challenge (SHA-256) contra Session Hijacking.`
    ]);

    // Fast-forward step simulation
    setTimeout(() => {
      setSandboxStep(1);
      setHandshakeLogs(prev => [
        ...prev,
        `[REDIRECT] Redirecionando requisição CORS-Safe para o gateway certificado.`,
        `[CALLBACK] Código de Autorização provisório interceptado via State Token seguro.`,
        `[ANTI-CSRF] Verificando token de estado contra falsificação de solicitação inter-site.`
      ]);
    }, 1200);

    setTimeout(() => {
      setSandboxStep(2);
      setHandshakeLogs(prev => [
        ...prev,
        `[JWT_DECRYPT] Token JWS do cabeçalho validado com chaves públicas rotativas.`,
        `[QUARANTINE_ACTIVE] ⚠️ QUARENTENA DE PRIVILÉGIOS ATIVA!`,
        `[RBAC] Usuário classificado como 'guest' sob custódia de auditoria. Liberação posterior via Super-Admin.`
      ]);
    }, 2450);
  };

  const handleCompleteSimulation = () => {
    toast.success("Login social simulado com sucesso em quarentena de segurança!");
    setShowSandbox(false);
    // Navigate using browser or app routing context
    navigate({ to: "/app" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8 relative">
      
      {/* SECURE OAUTH HANDSHAKE SANDBOX DIALOG overlay */}
      {showSandbox && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#0b1321] text-slate-100 max-w-lg w-full rounded-2xl border border-blue-500/20 p-6 space-y-5 shadow-2xl relative">
            <button 
              onClick={() => setShowSandbox(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1.5 border-b border-white/5 pb-3">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 animate-pulse" /> IAM Audit Handshake Protocol
              </span>
              <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                Simulador de Autenticação Segura via {activeProvider?.toUpperCase()}
              </h3>
            </div>

            {/* Stepper visualization */}
            <div className="flex items-center justify-between text-2xs font-mono font-bold bg-black/40 p-3 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${sandboxStep >= 0 ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>1</span>
                <span className={sandboxStep >= 0 ? "text-blue-300" : "text-slate-500"}>Handshake</span>
              </div>
              <div className="h-px bg-slate-800 flex-1 mx-3" />
              <div className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${sandboxStep >= 1 ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-400"}`}>2</span>
                <span className={sandboxStep >= 1 ? "text-amber-300" : "text-slate-500"}>Quarentena</span>
              </div>
              <div className="h-px bg-slate-800 flex-1 mx-3" />
              <div className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${sandboxStep >= 2 ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-400"}`}>3</span>
                <span className={sandboxStep >= 2 ? "text-emerald-300" : "text-slate-500"}>Acesso</span>
              </div>
            </div>

            {/* Simulated Shell Terminal Outputs */}
            <div className="rounded-xl border border-slate-800 bg-black/85 p-4.5 min-h-[170px] flex flex-col justify-between font-mono text-[10px] text-emerald-400 leading-relaxed">
              <div className="space-y-1.5">
                <div className="text-slate-500 text-3xs border-b border-white/5 pb-1 flex justify-between items-center mb-1">
                  <span>SECURE_IO_STREAM</span>
                  <Terminal className="h-3 w-3" />
                </div>
                {handshakeLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
              {sandboxStep < 2 ? (
                <div className="text-xs text-blue-400 mt-4 flex items-center gap-1.5 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" /> Realizando validações criptográficas...
                </div>
              ) : (
                <div className="text-2xs text-[#e0483e] mt-4 flex items-start gap-1.5 bg-red-950/20 border border-red-500/10 p-2.5 rounded-lg">
                  <LockKeyhole className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    <strong>Atenção:</strong> De acordo com as diretrizes de AppSec imob365, sua conta entrará no cargo provisório <strong>guest</strong>. Você poderá visualizar dados gerais, mas a liberação operacional definitiva exige autorização do <strong>super-admin</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Footer action buttons */}
            <div className="flex gap-2.5 pt-1.5">
              <Button 
                variant="outline" 
                onClick={() => setShowSandbox(false)}
                className="flex-1 text-xs font-bold border-white/10 text-slate-300 hover:bg-slate-800 bg-transparent hover:text-white"
              >
                Cancelar
              </Button>
              <Button 
                disabled={sandboxStep < 2}
                onClick={handleCompleteSimulation}
                className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
              >
                <UserCheck className="h-4 w-4" /> Concluir e Entrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN CARD */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center sm:text-left">
          <Link to="/" className="inline-block"><Logo className="h-7 w-auto" /></Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground font-sans">Acesse o painel da sua imobiliária.</p>
        </div>

        {/* SOCIAL AUTHENTICATION SECTOR */}
        <div className="mt-6 space-y-3">
          <Button 
            type="button" 
            onClick={() => triggerSocialLogin("google")}
            className="w-full py-5 text-xs font-bold border border-border bg-card text-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-center gap-2"
          >
            <Chrome className="h-4 w-4 text-[#e0483e]" />
            Entrar com o Google
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button 
              type="button" 
              onClick={() => triggerSocialLogin("apple")}
              className="w-full py-5 text-xs font-bold border border-border bg-card text-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-center gap-2"
            >
              <Apple className="h-4 w-4" />
              Apple Sign-In
            </Button>

            <Button 
              type="button" 
              onClick={() => triggerSocialLogin("instagram")}
              className="w-full py-5 text-xs font-bold border border-border bg-card text-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-center gap-2 col-span-1"
            >
              <Instagram className="h-4 w-4 text-pink-600" />
              Instagram (Meta)
            </Button>
          </div>

          {/* Secure Quarantine Warn badge */}
          <div className="flex items-center gap-2 bg-blue-500/[0.03] border border-blue-500/15 p-3 rounded-lg text-2xs text-muted-foreground/90 font-sans leading-relaxed">
            <Info className="h-4 w-4 text-primary shrink-0 text-blue-500" />
            <span>Contas recém-criadas entram em fila de análise de privilégios governada pelo super-admin.</span>
          </div>

          <div className="relative my-5 flex items-center">
            <div className="flex-grow border-t border-border/80"></div>
            <span className="mx-3 text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">ou continue com e-mail</span>
            <div className="flex-grow border-t border-border/80"></div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-5">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground font-sans">
          Ainda não tem conta? <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
