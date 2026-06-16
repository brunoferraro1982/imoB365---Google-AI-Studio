import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, UserCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type TipoUsuario = "corretor" | "imobiliaria";

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<TipoUsuario | null>(null);
  const [nome, setNome] = useState("");
  const [creci, setCreci] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [imobiliariaNome, setImobiliariaNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        void navigate({ to: "/", replace: true });
        return;
      }

      const userId = session.user.id;
      const provider =
        (session.user.app_metadata?.provider as string | undefined) ?? "oauth";
      const displayName =
        nome.trim() ||
        (session.user.user_metadata as any)?.full_name ||
        session.user.email?.split("@")[0] ||
        "Usuário";

      // Update profile with onboarding data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: displayName,
          tipo_usuario: tipo,
          imobiliaria_nome: tipo === "imobiliaria" ? imobiliariaNome || null : null,
          status: "pending_approval",
          oauth_provider: provider,
        } as any)
        .eq("id", userId);

      if (profileError) throw profileError;

      // Insert pending registration for admin review
      const { error: regError } = await supabase
        .from("pending_registrations")
        .insert({
          user_id: userId,
          email: session.user.email!,
          nome: displayName,
          tipo_usuario: tipo,
          creci: tipo === "corretor" && creci ? creci : null,
          cnpj: tipo === "imobiliaria" && cnpj ? cnpj : null,
          imobiliaria_nome:
            tipo === "imobiliaria" && imobiliariaNome ? imobiliariaNome : null,
        } as any);

      if (regError) throw regError;

      void navigate({ to: "/pending-approval", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar cadastro.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto mb-2">
            <span className="text-xl font-black text-primary">i365</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Bem-vindo ao imob365</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Complete seu perfil para solicitar acesso à plataforma.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
          <span className={`font-bold ${step === 1 ? "text-primary" : ""}`}>1. Perfil</span>
          <span>→</span>
          <span className={`font-bold ${step === 2 ? "text-primary" : ""}`}>2. Dados</span>
        </div>

        {/* Step 1: Select tipo */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-center text-foreground/80">
              Como você utilizará o imob365?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setTipo("corretor");
                  setStep(2);
                }}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <UserCheck className="h-8 w-8 text-primary" />
                <div className="space-y-0.5 text-center">
                  <p className="font-bold text-sm">Corretor</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Profissional autônomo com CRECI
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setTipo("imobiliaria");
                  setStep(2);
                }}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <Building2 className="h-8 w-8 text-primary" />
                <div className="space-y-0.5 text-center">
                  <p className="font-bold text-sm">Imobiliária</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Empresa com equipe de corretores
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Fill details */}
        {step === 2 && tipo && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar
            </button>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label
                  htmlFor="onb-nome"
                  className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                >
                  Nome Completo
                </Label>
                <Input
                  id="onb-nome"
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="h-9"
                />
              </div>

              {tipo === "corretor" && (
                <div className="space-y-1">
                  <Label
                    htmlFor="onb-creci"
                    className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                  >
                    CRECI
                  </Label>
                  <Input
                    id="onb-creci"
                    placeholder="Ex: SP-123456-F"
                    value={creci}
                    onChange={(e) => setCreci(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
              )}

              {tipo === "imobiliaria" && (
                <>
                  <div className="space-y-1">
                    <Label
                      htmlFor="onb-imob"
                      className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                    >
                      Nome da Imobiliária
                    </Label>
                    <Input
                      id="onb-imob"
                      placeholder="Nome fantasia ou razão social"
                      value={imobiliariaNome}
                      onChange={(e) => setImobiliariaNome(e.target.value)}
                      required
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="onb-cnpj"
                      className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                    >
                      CNPJ{" "}
                      <span className="normal-case font-normal text-muted-foreground/60">
                        (opcional)
                      </span>
                    </Label>
                    <Input
                      id="onb-cnpj"
                      placeholder="00.000.000/0001-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-bold h-9"
            >
              {loading ? "Enviando solicitação…" : "Solicitar Acesso →"}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Sua solicitação será analisada em até 1 dia útil.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
