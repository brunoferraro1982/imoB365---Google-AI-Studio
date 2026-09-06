import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertTriangle } from "lucide-react";
import { finalizarEdicaoNoCanva } from "@/lib/canvaDesign.functions";

// Return URL fixo da integração Canva (configurado uma vez no painel de
// desenvolvedor, ver app.portais.canva.tsx) — a Canva navega o navegador
// do corretor pra cá, com ?correlation_jwt=..., assim que ele clica em
// "Voltar" dentro do próprio editor da Canva. Essa página só existe pra
// processar esse retorno e mandar o corretor de volta pro imóvel com a
// imagem já editada.
export const Route = createFileRoute("/app/imoveis/canva-retorno")({
  head: () => ({ meta: [{ title: "Finalizando edição — imob365" }] }),
  component: CanvaRetornoPage,
});

function CanvaRetornoPage() {
  const search = useSearch({ strict: false }) as { correlation_jwt?: string };
  const finalizar = useServerFn(finalizarEdicaoNoCanva);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!search.correlation_jwt) {
      setErro("Parâmetro de retorno da Canva ausente.");
      return;
    }
    finalizar({ data: { correlationJwt: search.correlation_jwt } })
      .then(({ imovelId, mediaPublicUrl }) => {
        window.location.href = `/app/imoveis/${imovelId}?canva_preview=${encodeURIComponent(mediaPublicUrl)}`;
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao finalizar a edição."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      {erro ? (
        <>
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{erro}</p>
          <Link to="/app/imoveis" className="text-sm text-primary underline underline-offset-2">
            Voltar pros imóveis
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Trazendo sua imagem editada da Canva de volta pra imob365…
          </p>
        </>
      )}
    </div>
  );
}
