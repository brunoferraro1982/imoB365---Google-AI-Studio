import { useState, type ReactNode } from "react";
import { BlogImoveisColumn } from "@/components/blog/BlogImoveisColumn";
import { BlogParceirosColumn } from "@/components/blog/BlogParceirosColumn";

// Shell de 3 colunas usado tanto pela listagem (/blog) quanto pelo artigo
// (/blog/$slug): imóveis à venda/locação (esq.) | conteúdo (centro) |
// parceiros/construtoras (dir.). Mesmo espírito de SiteWidgetsLayout
// (src/components/site/SiteWidgets.tsx) — coluna vazia não reserva espaço
// em branco — mas com uma diferença deliberada: aqui as colunas laterais
// continuam visíveis no mobile (só reordenadas pra depois do conteúdo, via
// `order-*`), em vez de `hidden` abaixo do breakpoint — o objetivo é dar
// visibilidade real a imóveis/parceiros pra quem lê no celular também, só
// sem competir com o conteúdo do blog pela primeira dobra.
//
// Atenção: `grid`/`grid-cols-1` ficam sempre ativos (nunca atrás de `lg:`)
// — CSS `order` só tem efeito dentro de um container flex/grid já ativo, e
// gatear o `grid` inteiro atrás de `lg:` quebraria a reordenação no mobile.
export function BlogColumnsLayout({ children }: { children: ReactNode }) {
  const [showImoveis, setShowImoveis] = useState(true);
  const [showParceiros, setShowParceiros] = useState(true);

  const gridCols =
    showImoveis && showParceiros
      ? "lg:grid-cols-[280px_minmax(0,1fr)_280px]"
      : showImoveis
        ? "lg:grid-cols-[280px_minmax(0,1fr)]"
        : showParceiros
          ? "lg:grid-cols-[minmax(0,1fr)_280px]"
          : "";

  return (
    <div
      className={`mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 lg:items-start lg:px-6 ${gridCols}`}
    >
      {showImoveis && (
        <aside className="order-2 lg:order-1 lg:sticky lg:top-20 lg:self-start">
          <BlogImoveisColumn onHasContent={setShowImoveis} />
        </aside>
      )}
      <div className="order-1 min-w-0 lg:order-2">{children}</div>
      {showParceiros && (
        <aside className="order-3 lg:sticky lg:top-20 lg:self-start">
          <BlogParceirosColumn onHasContent={setShowParceiros} />
        </aside>
      )}
    </div>
  );
}
