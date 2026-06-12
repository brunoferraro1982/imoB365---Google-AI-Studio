/**
 * GlobalBreadcrumb — breadcrumb automático baseado no pathname.
 * Substituir breadcrumbs hardcoded em cada página.
 *
 * Uso: <GlobalBreadcrumb />
 * (Coloca no AppShell ou no layout de cada módulo)
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

const PATH_LABELS: Record<string, string> = {
  app:            "Início",
  imobiliario:    "Imobiliário",
  imoveis:        "Imóveis",
  leads:          "Leads",
  visitas:        "Visitas",
  financeiro:     "Financeiro",
  "plano-contas": "Plano de Contas",
  "centros-custo":"Centros de Custo",
  lancamentos:    "Lançamentos",
  comissoes:      "Comissões",
  juridico:       "Jurídico",
  contratos:      "Contratos",
  modelos:        "Modelos",
  marketing:      "Marketing",
  campanhas:      "Campanhas",
  ajustes:        "Ajustes",
  configuracoes:  "Configurações",
  admin:          "Admin",
};

interface BreadcrumbItem {
  label: string;
  path: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, index) => ({
    label: PATH_LABELS[seg] ?? seg,
    path: "/" + segments.slice(0, index + 1).join("/"),
  }));
}

export function GlobalBreadcrumb() {
  const { location } = useRouterState();
  const items = buildBreadcrumbs(location.pathname);

  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link to="/app" aria-label="Início" className="hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.slice(1).map((item, index, arr) => {
        const isLast = index === arr.length - 1;
        return (
          <span key={item.path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path as "/app"}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
