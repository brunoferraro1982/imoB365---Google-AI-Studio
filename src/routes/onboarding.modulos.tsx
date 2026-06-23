import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Building, Banknote, Scale, Megaphone, GraduationCap, ArrowRight } from "lucide-react";

type PerfilId =
  | "perfil-corretor"
  | "perfil-corret-imob"
  | "perfil-adm-imob"
  | "perfil-finac-imob"
  | "perfil-mkt-imob"
  | "perfil-jur-imob";

type ModSearch = { perfil?: string };

export const Route = createFileRoute("/onboarding/modulos")({
  validateSearch: (raw: Record<string, unknown>): ModSearch => ({
    perfil: typeof raw.perfil === "string" ? raw.perfil : undefined,
  }),
  component: OnboardingModulos,
});

const MODULOS = [
  {
    id: "imobiliario",
    label: "Imobiliário & CRM",
    desc: "Cadastro de imóveis, captação de leads e pipeline de vendas",
    icon: Building,
    core: true,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    desc: "Comissões, recebimentos, repasses e relatórios",
    icon: Banknote,
    core: false,
  },
  {
    id: "juridico",
    label: "Jurídico",
    desc: "Geração de contratos, assinatura digital e compliance",
    icon: Scale,
    core: false,
  },
  {
    id: "marketing",
    label: "Marketing & Site",
    desc: "Site white-label, portais externos, blog e campanhas",
    icon: Megaphone,
    core: false,
  },
  {
    id: "elearning",
    label: "E-Learning",
    desc: "Capacitação de corretores, cursos e certificações",
    icon: GraduationCap,
    core: false,
  },
] as const;

type ModId = (typeof MODULOS)[number]["id"];

const PRE_SELECT: Record<PerfilId, ModId[]> = {
  "perfil-corretor":    ["imobiliario"],
  "perfil-corret-imob": ["imobiliario"],
  "perfil-adm-imob":   ["imobiliario", "financeiro", "juridico", "marketing"],
  "perfil-finac-imob": ["imobiliario", "financeiro"],
  "perfil-mkt-imob":   ["imobiliario", "marketing"],
  "perfil-jur-imob":   ["imobiliario", "juridico"],
};

function defaultSelection(perfil: string | undefined): Set<ModId> {
  const preset = PRE_SELECT[perfil as PerfilId] ?? ["imobiliario"];
  return new Set(preset);
}

function OnboardingModulos() {
  const navigate = useNavigate();
  const { perfil } = Route.useSearch();
  const [selected, setSelected] = useState<Set<ModId>>(() => defaultSelection(perfil));

  function toggle(id: ModId) {
    if (id === "imobiliario") return; // core: sempre ativo
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNext() {
    void navigate({
      to: "/onboarding/plano",
      search: {
        perfil: perfil ?? "",
        mods: Array.from(selected).join(","),
      },
      replace: false,
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <Logo className="h-8 w-auto mx-auto mb-4" />
          <StepIndicator current={2} />
          <h1 className="text-2xl font-black tracking-tight mt-4">Quais módulos você precisa?</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Selecione os recursos que sua operação vai usar. Você pode ajustar depois.
          </p>
        </div>

        <div className="space-y-2.5">
          {MODULOS.map((m) => {
            const active = selected.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/20"
                } ${m.core ? "cursor-default" : ""}`}
              >
                <div
                  className={`p-2.5 rounded-lg ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{m.label}</p>
                    {m.core && (
                      <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                        ESSENCIAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    active ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}
                >
                  {active && (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button onClick={handleNext} className="w-full font-bold h-11">
          Continuar <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
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
