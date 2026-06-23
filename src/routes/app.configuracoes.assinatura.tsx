import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/assinatura")({
  component: Assinatura,
});

type Plan = {
  slug: string;
  nome: string;
  preco_mensal: number;
  limites: { imoveis?: number; modulos?: number; usuarios?: number } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trial:     { label: "Trial",     color: "bg-blue-100 text-blue-700 border-blue-200"   },
  active:    { label: "Ativo",     color: "bg-green-100 text-green-700 border-green-200" },
  suspended: { label: "Suspenso",  color: "bg-red-100 text-red-700 border-red-200"       },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border"  },
};

function Assinatura() {
  const { tenantInfo, isAdmin, isSuperAdmin } = useAuth();
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [changing, setChanging]   = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmChange, setConfirmChange] = useState(false);

  useEffect(() => {
    supabase
      .from("plans")
      .select("slug, nome, preco_mensal, limites")
      .eq("ativo", true)
      .order("preco_mensal", { ascending: true })
      .then(({ data }) => {
        setPlans((data as Plan[]) ?? []);
        setLoading(false);
      });
  }, []);

  const currentPlan = plans.find((p) => p.slug === tenantInfo?.plano_slug);
  const status = tenantInfo?.status ?? "active";
  const billingDue = tenantInfo?.billing_due_at
    ? new Date(tenantInfo.billing_due_at).toLocaleDateString("pt-BR")
    : null;

  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.active;

  function isUpgrade(plan: Plan) {
    return plan.preco_mensal > (currentPlan?.preco_mensal ?? 0);
  }

  async function handleChangePlan() {
    if (!selectedPlan) return;
    setChanging(true);
    setConfirmChange(false);
    const { error } = await supabase.rpc("change_tenant_plan", { p_new_plan: selectedPlan.slug });
    if (error) {
      toast.error(`Erro ao alterar plano: ${error.message}`);
    } else {
      toast.success(`Plano alterado para ${selectedPlan.nome} com sucesso.`);
      window.location.reload();
    }
    setChanging(false);
  }

  async function handleCancel() {
    setCancelling(true);
    setConfirmCancel(false);
    const { error } = await supabase.rpc("cancel_tenant");
    if (error) {
      toast.error(`Erro ao cancelar conta: ${error.message}`);
    } else {
      toast.success("Conta cancelada. Seus dados ficam disponíveis por 30 dias.");
      window.location.reload();
    }
    setCancelling(false);
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Assinatura</h1>
      </div>

      {/* Resumo do plano atual */}
      <div className="border rounded-xl p-6 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plano atual</p>
            <p className="text-2xl font-bold">{currentPlan?.nome ?? tenantInfo?.plano_slug ?? "—"}</p>
            {currentPlan && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentPlan.preco_mensal === 0
                  ? "Gratuito"
                  : `${formatBRL(currentPlan.preco_mensal)}/mês`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {billingDue && status === "active" && (
              <p className="text-xs text-muted-foreground">Próxima cobrança: {billingDue}</p>
            )}
            {status === "suspended" && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Conta suspensa por inadimplência
              </p>
            )}
          </div>
        </div>

        {currentPlan?.limites && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
            {currentPlan.limites.imoveis != null && (
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {currentPlan.limites.imoveis === 9999 ? "∞" : currentPlan.limites.imoveis}
                </p>
                <p className="text-xs text-muted-foreground">Imóveis</p>
              </div>
            )}
            {currentPlan.limites.usuarios != null && (
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {currentPlan.limites.usuarios === 99 ? "∞" : currentPlan.limites.usuarios}
                </p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            )}
            {currentPlan.limites.modulos != null && (
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {currentPlan.limites.modulos === -1 ? "∞" : currentPlan.limites.modulos}
                </p>
                <p className="text-xs text-muted-foreground">Módulos</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seleção de plano */}
      {status !== "cancelled" && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Alterar plano
          </h2>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.slug === tenantInfo?.plano_slug;
                const up = isUpgrade(plan);
                return (
                  <button
                    key={plan.slug}
                    disabled={isCurrent || status === "suspended"}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setConfirmChange(true);
                    }}
                    className={[
                      "flex flex-col items-start rounded-lg border p-4 text-left transition",
                      isCurrent
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 cursor-default"
                        : status === "suspended"
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-primary/50 hover:bg-muted/30 cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-semibold">{plan.nome}</span>
                      {isCurrent ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : up ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <span className="mt-1 text-sm text-muted-foreground">
                      {plan.preco_mensal === 0 ? "Gratuito" : `${formatBRL(plan.preco_mensal)}/mês`}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="mt-2 text-[10px]">Plano atual</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancelamento */}
      {status === "active" && (
        <div className="border border-red-200 rounded-xl p-5 bg-red-50/30">
          <h2 className="text-sm font-semibold text-red-700">Cancelar conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ao cancelar, sua conta será desativada e seus dados ficam disponíveis por 30 dias para exportação.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelling}
          >
            Cancelar conta
          </Button>
        </div>
      )}

      {/* Dialog: confirmar troca de plano */}
      <Dialog open={confirmChange} onOpenChange={setConfirmChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && isUpgrade(selectedPlan) ? "Confirmar upgrade" : "Confirmar downgrade"}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>
                  Você está alterando de{" "}
                  <strong>{currentPlan?.nome ?? tenantInfo?.plano_slug}</strong> para{" "}
                  <strong>{selectedPlan.nome}</strong>.
                  {selectedPlan.preco_mensal > 0 && (
                    <> O novo valor de <strong>{formatBRL(selectedPlan.preco_mensal)}/mês</strong> será cobrado na próxima data de faturamento.</>
                  )}
                  {isUpgrade(selectedPlan)
                    ? " Os módulos do novo plano serão habilitados imediatamente."
                    : " Módulos fora da nova cota serão desabilitados automaticamente."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmChange(false)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={changing}>
              {changing ? "Alterando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar cancelamento */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Sua conta será desativada imediatamente e seu plano será
              revertido para Gratuito. Seus dados ficam disponíveis por 30 dias.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelando…" : "Sim, cancelar minha conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
