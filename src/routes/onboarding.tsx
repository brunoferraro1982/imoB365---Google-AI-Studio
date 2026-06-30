import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building2,
  UserCheck,
  ArrowLeft,
  Phone,
  Home,
  DollarSign,
  Megaphone,
  Scale,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type TipoUsuario = "corretor" | "imobiliaria";

const MODULES = [
  {
    slug: "mod-imob",
    nome: "Vendas & Imóveis",
    descricao: "Catálogo de imóveis, CRM de leads, pipeline e gestão de corretores",
    icon: Home,
  },
  {
    slug: "mod-fin",
    nome: "Financeiro",
    descricao: "Comissões, cobranças, relatórios financeiros e fluxo de caixa",
    icon: DollarSign,
  },
  {
    slug: "mod-mkt",
    nome: "Marketing & Site",
    descricao: "Site próprio, blog, portais (ZAP/OLX), campanhas e automações",
    icon: Megaphone,
  },
  {
    slug: "mod-juri",
    nome: "Jurídico",
    descricao: "Contratos digitais, assinatura eletrônica e compliance",
    icon: Scale,
  },
  {
    slug: "mod-elearn",
    nome: "E-Learning",
    descricao: "Treinamento de corretores, cursos e certificações internas",
    icon: GraduationCap,
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<TipoUsuario | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [creci, setCreci] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [imobiliariaNome, setImobiliariaNome] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(["mod-imob"]));
  const [loading, setLoading] = useState(false);

  function canAdvanceToStep3() {
    if (!tipo || !nome.trim()) return false;
    if (tipo === "corretor" && !creci.trim()) return false;
    if (tipo === "imobiliaria" && !imobiliariaNome.trim()) return false;
    return true;
  }

  function toggleModule(slug: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        if (slug === "mod-imob") return next;
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

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

      const displayName =
        nome.trim() ||
        ((session.user.user_metadata as Record<string, unknown>)?.full_name as string) ||
        session.user.email?.split("@")[0] ||
        "Usuário";

      await completeOnboarding({
        data: {
          nome: displayName,
          telefone: telefone.trim() || undefined,
          tipo,
          creci: tipo === "corretor" ? creci.trim() || undefined : undefined,
          cnpj: tipo === "imobiliaria" ? cnpj.trim() || undefined : undefined,
          imobiliariaNome: tipo === "imobiliaria" ? imobiliariaNome || undefined : undefined,
          modulosInteresse: Array.from(selectedModules),
        },
      });

      toast.success("Trial Business ativado! Acesso liberado por 30 dias.");
      void navigate({ to: "/app", replace: true });
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
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto mb-2">
            <span className="text-xl font-black text-primary">i365</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Bem-vindo ao imob365</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Complete seu perfil para solicitar acesso à plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
          <span className={`font-bold ${step === 1 ? "text-primary" : ""}`}>1. Perfil</span>
          <span>→</span>
          <span className={`font-bold ${step === 2 ? "text-primary" : ""}`}>2. Dados</span>
          <span>→</span>
          <span className={`font-bold ${step === 3 ? "text-primary" : ""}`}>3. Módulos</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-center text-foreground/80">
              Como você utilizará o imob365?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setTipo("corretor"); setStep(2); }}
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
                onClick={() => { setTipo("imobiliaria"); setStep(2); }}
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

        {step === 2 && tipo && (
          <div className="space-y-4">
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
                <Label htmlFor="onb-nome" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
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

              <div className="space-y-1">
                <Label htmlFor="onb-tel" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  Telefone / WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="onb-tel"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
              </div>

              {tipo === "corretor" && (
                <div className="space-y-1">
                  <Label htmlFor="onb-creci" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
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
                    <Label htmlFor="onb-imob" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
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
                    <Label htmlFor="onb-cnpj" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                      CNPJ{" "}
                      <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>
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
              type="button"
              disabled={!canAdvanceToStep3()}
              onClick={() => setStep(3)}
              className="w-full font-bold h-9"
            >
              Continuar →
            </Button>
          </div>
        )}

        {step === 3 && tipo && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar
            </button>

            <p className="text-sm font-semibold text-center text-foreground/80">
              Quais módulos você pretende utilizar?
            </p>
            <p className="text-[10px] text-center text-muted-foreground -mt-2">
              Selecione as funcionalidades de interesse. Isso nos ajuda a configurar sua experiência.
            </p>

            <div className="space-y-2">
              {MODULES.map((mod) => {
                const Icon = mod.icon;
                const selected = selectedModules.has(mod.slug);
                const isCore = mod.slug === "mod-imob";
                return (
                  <button
                    key={mod.slug}
                    type="button"
                    onClick={() => toggleModule(mod.slug)}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{mod.nome}</p>
                        {isCore && (
                          <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            Incluído
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {mod.descricao}
                      </p>
                    </div>
                    <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                      selected
                        ? "bg-primary border-primary"
                        : "border-border"
                    }`}>
                      {selected && (
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              type="submit"
              disabled={loading || selectedModules.size === 0}
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
