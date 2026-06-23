import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { Sparkles, Check, ShieldCheck, Zap } from "lucide-react";

type PlanoSearch = { perfil?: string; mods?: string };

export const Route = createFileRoute("/onboarding/plano")({
  validateSearch: (raw: Record<string, unknown>): PlanoSearch => ({
    perfil: typeof raw.perfil === "string" ? raw.perfil : undefined,
    mods:   typeof raw.mods === "string"   ? raw.mods   : undefined,
  }),
  component: OnboardingPlano,
});

function recommendedPlan(mods: string[]): { slug: string; nome: string; preco: number } {
  const n = mods.length;
  if (n >= 4) return { slug: "plan-busi", nome: "Business", preco: 899 };
  if (n >= 3) return { slug: "plan-pro",  nome: "Pro",      preco: 399 };
  if (n >= 2) return { slug: "plan-stand",nome: "Standard", preco: 199 };
  return        { slug: "plan-free",       nome: "Free",     preco:   0 };
}

const BENEFICIOS_TRIAL = [
  "Acesso completo a todos os módulos Business por 30 dias",
  "Sem necessidade de cartão de crédito",
  "Importação assistida de imóveis e leads",
  "Suporte prioritário durante o trial",
  "Converta para o plano ideal ao final do período",
];

function OnboardingPlano() {
  const navigate = useNavigate();
  const { perfil, mods } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [imobiliariaNome, setImobiliariaNome] = useState("");

  const selectedMods = mods ? mods.split(",").filter(Boolean) : ["imobiliario"];
  const recommended = recommendedPlan(selectedMods);

  async function handleActivate() {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        void navigate({ to: "/", replace: true });
        return;
      }

      const displayName =
        nome.trim() ||
        (session.user.user_metadata as any)?.full_name ||
        session.user.email?.split("@")[0] ||
        "Usuário";

      // Chama a função SECURITY DEFINER que cria o tenant + ativa trial + aprova perfil
      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_tipo_usuario:     perfil ?? "perfil-adm-imob",
        p_nome:             displayName,
        p_imobiliaria_nome: imobiliariaNome.trim() || displayName,
      });

      if (error) throw error;

      toast.success("Trial Business ativado! Bem-vindo ao imob365 🎉");
      void navigate({ to: "/app", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao ativar trial.";
      toast.error(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <Logo className="h-8 w-auto mx-auto mb-4" />
          <StepIndicator current={3} />
          <h1 className="text-2xl font-black tracking-tight mt-4">
            Tudo pronto — ative seu trial Business
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Com base nos módulos selecionados, o plano recomendado seria{" "}
            <strong>{recommended.nome}</strong>. Por 30 dias você terá acesso Business completo.
          </p>
        </div>

        {/* Trial card */}
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-lg text-foreground">Trial Business</p>
              <p className="text-xs text-muted-foreground">30 dias grátis • Sem cartão</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-black text-primary">R$ 0</p>
              <p className="text-[10px] text-muted-foreground">nos primeiros 30 dias</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            {BENEFICIOS_TRIAL.map((b) => (
              <li key={b} className="flex items-start gap-2 text-foreground/80">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Dados complementares */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Seu nome
            </label>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Nome da imobiliária
            </label>
            <input
              type="text"
              placeholder="Nome fantasia ou razão social"
              value={imobiliariaNome}
              onChange={(e) => setImobiliariaNome(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => void handleActivate()}
            disabled={loading}
            className="w-full font-bold h-11"
          >
            {loading ? (
              "Ativando trial…"
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Ativar Trial Business 30 dias — Grátis
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Sem cobranças durante o período de trial</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Perfil", "Módulos", "Plano"];
  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      {steps.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === current;
        const done = n < current;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {s}
            </span>
            {i < 2 && <span className="text-muted-foreground/40">→</span>}
          </div>
        );
      })}
    </div>
  );
}
