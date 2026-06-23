import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Clock } from "lucide-react";
import type { TenantInfo } from "@/hooks/useAuth";

interface Props {
  tenantInfo: TenantInfo;
  onDismiss: () => void;
}

function daysSinceExpiry(trial_ends_at: string): number {
  const diff = Date.now() - new Date(trial_ends_at).getTime();
  return Math.floor(diff / 86_400_000);
}

export function TrialExpiredModal({ tenantInfo, onDismiss }: Props) {
  const [loading, setLoading] = useState(false);

  if (tenantInfo.status !== "trial" || !tenantInfo.trial_ends_at) return null;

  const expired = new Date(tenantInfo.trial_ends_at).getTime() < Date.now();
  if (!expired) return null;

  const days = daysSinceExpiry(tenantInfo.trial_ends_at);
  const label =
    days === 0
      ? "Seu trial Business expirou hoje."
      : days === 1
        ? "Seu trial Business expirou há 1 dia."
        : `Seu trial Business expirou há ${days} dias.`;

  async function handleDowngrade() {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("downgrade_trial_to_free");
      if (error) throw error;
      toast.success("Plano alterado para Free. Bem-vindo ao imob365 gratuito!");
      onDismiss();
      // Força reload para atualizar enabledModules
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar plano.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center border-b border-border">
          <Logo className="h-7 w-auto mx-auto mb-4" />
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-black tracking-tight">Trial encerrado</h2>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed text-center">
            Para continuar usando todos os recursos Business, escolha um plano de assinatura.
            Ou continue gratuitamente com as funcionalidades do plano Free.
          </p>

          <div className="space-y-2.5">
            <Link to="/planos" className="block">
              <Button className="w-full font-bold h-11">
                <Sparkles className="h-4 w-4 mr-2" />
                Ver planos de assinatura
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={() => void handleDowngrade()}
              disabled={loading}
            >
              {loading ? "Alterando plano…" : "Continuar com plano Free (grátis)"}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
            No plano Free você mantém até 25 imóveis, 3 usuários e acesso ao CRM básico.
            Seus dados ficam preservados ao fazer upgrade.
          </p>
        </div>
      </div>
    </div>
  );
}
