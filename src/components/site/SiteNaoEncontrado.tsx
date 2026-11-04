import { Link } from "@tanstack/react-router";

/** Estado "site não encontrado/não publicado" das rotas /site/$slug/*. */
export function SiteNaoEncontrado() {
  return (
    <div className="site-mesh flex min-h-screen flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
      <div className="glass-fosco max-w-md rounded-3xl p-8">
        <h1 className="text-2xl font-bold">Site indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este site ainda não foi publicado ou o endereço está incorreto.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          ← Voltar ao portal imoB365
        </Link>
      </div>
    </div>
  );
}
