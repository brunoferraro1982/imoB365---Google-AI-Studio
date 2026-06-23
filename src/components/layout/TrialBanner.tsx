import { Link } from "@tanstack/react-router";
import { Clock, Zap, AlertTriangle } from "lucide-react";
import type { TenantInfo } from "@/hooks/useAuth";

interface TrialBannerProps {
  tenantInfo: TenantInfo;
}

function daysLeft(trial_ends_at: string): number {
  const diff = new Date(trial_ends_at).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function TrialBanner({ tenantInfo }: TrialBannerProps) {
  if (tenantInfo.status !== "trial" || !tenantInfo.trial_ends_at) return null;

  const days = daysLeft(tenantInfo.trial_ends_at);
  if (days <= 0) return null; // expired → handled by TrialExpiredModal

  const urgent = days <= 2;
  const warning = days <= 7;

  const label =
    days === 1
      ? "Seu trial Business expira hoje!"
      : `Seu trial Business expira em ${days} dias`;

  const bg = urgent
    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
    : warning
      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
      : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800";

  const text = urgent
    ? "text-red-700 dark:text-red-300"
    : warning
      ? "text-amber-700 dark:text-amber-300"
      : "text-blue-700 dark:text-blue-300";

  const Icon = urgent ? AlertTriangle : Clock;

  return (
    <div className={`flex items-center justify-between px-4 py-2 border-b text-xs font-medium ${bg}`}>
      <div className={`flex items-center gap-2 ${text}`}>
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{label}</span>
      </div>
      <Link
        to="/planos"
        className={`flex items-center gap-1 font-bold underline underline-offset-2 hover:no-underline transition-all ${text}`}
      >
        <Zap className="h-3 w-3" />
        Assinar agora
      </Link>
    </div>
  );
}
