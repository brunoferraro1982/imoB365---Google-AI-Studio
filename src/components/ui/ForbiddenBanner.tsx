/**
 * ForbiddenBanner — exibido quando o usuário é redirecionado
 * de uma rota não autorizada (?forbidden=1).
 *
 * Uso no layout /app:
 *   const search = Route.useSearch();
 *   {search.forbidden && <ForbiddenBanner />}
 */
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function ForbiddenBanner() {
  const navigate = useNavigate();

  // Limpar o query param após 5 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      void navigate({
        to: "/app",
        search: {},
        replace: true,
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4"
    >
      <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
      <span>
        Você não tem permissão para acessar este módulo.
        Entre em contato com o administrador se precisar de acesso.
      </span>
    </div>
  );
}
