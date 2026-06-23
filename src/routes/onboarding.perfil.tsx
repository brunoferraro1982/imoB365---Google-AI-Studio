import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import {
  UserCheck,
  Building2,
  Banknote,
  Megaphone,
  Scale,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/onboarding/perfil")({
  component: OnboardingPerfil,
});

const PERFIS = [
  {
    id: "perfil-corretor",
    label: "Corretor Autônomo",
    desc: "Profissional liberal com CRECI próprio",
    icon: UserCheck,
  },
  {
    id: "perfil-corret-imob",
    label: "Corretor Vinculado",
    desc: "Corretor associado a uma imobiliária",
    icon: Users,
  },
  {
    id: "perfil-adm-imob",
    label: "Administrador",
    desc: "Gestor ou sócio da imobiliária",
    icon: Building2,
  },
  {
    id: "perfil-finac-imob",
    label: "Financeiro",
    desc: "Responsável pela área financeira",
    icon: Banknote,
  },
  {
    id: "perfil-mkt-imob",
    label: "Marketing",
    desc: "Responsável por marketing e portais",
    icon: Megaphone,
  },
  {
    id: "perfil-jur-imob",
    label: "Jurídico",
    desc: "Responsável por contratos e compliance",
    icon: Scale,
  },
] as const;

type PerfilId = (typeof PERFIS)[number]["id"];

function OnboardingPerfil() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function select(perfil: PerfilId) {
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      void navigate({ to: "/", replace: true });
      return;
    }

    // Salva tipo_usuario provisoriamente para que Step 2 possa pré-selecionar módulos
    await supabase
      .from("profiles")
      .update({ tipo_usuario: perfil } as any)
      .eq("id", session.user.id);

    void navigate({
      to: "/onboarding/modulos",
      search: { perfil },
      replace: false,
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <Logo className="h-8 w-auto mx-auto mb-4" />
          <StepIndicator current={1} />
          <h1 className="text-2xl font-black tracking-tight mt-4">Qual é o seu perfil?</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Escolha a opção que melhor descreve como você vai usar o imob365.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PERFIS.map((p) => (
            <button
              key={p.id}
              disabled={saving}
              onClick={() => void select(p.id)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 text-center"
            >
              <p.icon className="h-8 w-8 text-primary" />
              <div className="space-y-0.5">
                <p className="font-bold text-sm">{p.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{p.desc}</p>
              </div>
            </button>
          ))}
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
