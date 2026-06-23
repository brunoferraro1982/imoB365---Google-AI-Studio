/**
 * imoB365 — MfaGuard
 *
 * Wrapper para rotas protegidas que exigem MFA.
 * Uso: envolver o conteúdo do layout autenticado.
 *
 * <MfaGuard userId={user.id}>
 *   <Outlet />
 * </MfaGuard>
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMfaGuard } from "@/hooks/useMfaGuard";

interface MfaGuardProps {
  userId: string | null | undefined;
  children: React.ReactNode;
}

export function MfaGuard({ userId, children }: MfaGuardProps) {
  const navigate = useNavigate();
  const { mfaRequired, mfaSetupDone, checking, exempt } = useMfaGuard(userId);

  useEffect(() => {
    if (checking || exempt) return;

    if (mfaRequired && !mfaSetupDone) {
      void navigate({ to: "/conta/mfa-setup" as never });
    }
  }, [mfaRequired, mfaSetupDone, checking, exempt, navigate]);

  // Enquanto verifica, renderizar normalmente (evitar flash)
  if (checking) return <>{children}</>;

  // Se MFA necessário e não configurado → não renderiza conteúdo (redirect no useEffect)
  if (mfaRequired && !mfaSetupDone && !exempt) return null;

  return <>{children}</>;
}
