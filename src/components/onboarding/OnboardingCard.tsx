import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowRight, X, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";

type Props = { tenantId: string };

export function OnboardingCard({ tenantId }: Props) {
  const { loading, steps, completedCount, totalCount, dismissed, dismiss } =
    useOnboarding(tenantId);

  if (loading || dismissed || completedCount === totalCount) return null;

  const pct = Math.round((completedCount / totalCount) * 100);
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-foreground">Primeiros passos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} de {totalCount} etapas concluídas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dispensar guia de primeiros passos"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5 space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs font-semibold text-primary">{pct}%</p>
      </div>

      {/* Steps */}
      <ul className="space-y-2 mb-5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3">
            {step.done ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-4.5 w-4.5 shrink-0 text-muted-foreground/60" />
            )}
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-semibold ${
                  step.done ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {step.label}
              </span>
              {!step.done && (
                <p className="text-xs text-muted-foreground truncate">{step.description}</p>
              )}
            </div>
            {!step.done && (
              <Link
                to={step.href as never}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Ir →
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {nextStep && (
        <Button asChild size="sm" className="w-full gap-2">
          <Link to={nextStep.href as never}>
            Continuar: {nextStep.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}
