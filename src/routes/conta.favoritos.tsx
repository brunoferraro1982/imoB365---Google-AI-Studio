import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarFavoritos, removerFavorito } from "@/lib/favoritos.functions";
import { removeFromFavoritosCache } from "@/components/FavoritoButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { MapPin, Bed, Bath, Maximize2, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/favoritos")({
  head: () => ({ meta: [{ title: "Meus favoritos — imob365" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const listar = useServerFn(listarFavoritos);
  const remover = useServerFn(removerFavorito);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    listar()
      .then((r) => setItems(r.favoritos as any[]))
      .catch((e: any) => toast.error(e?.message ?? "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [user, authLoading, listar, navigate]);

  function publicUrl(path: string | null | undefined) {
    if (!path) return null;
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
  }

  async function handleRemove(imovelId: string) {
    try {
      await remover({ data: { imovel_id: imovelId } });
      setItems((prev) => prev.filter((f) => f.imovel_id !== imovelId));
      removeFromFavoritosCache(imovelId);
      toast.success("Removido dos favoritos");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        <h1 className="text-3xl font-bold tracking-tight">Meus favoritos</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Imóveis que você salvou para acompanhar.</p>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não favoritou nenhum imóvel.</p>
            <Link to="/buscar"><Button className="mt-4">Buscar imóveis</Button></Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((f: any) => {
              const i = f.imoveis;
              if (!i) return null;
              const fotos = (i.imovel_fotos ?? []).slice().sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
              const capa = fotos[0]?.storage_path ?? null;
              return (
                <div key={f.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg">
                  <Link to="/imovel/$slug" params={{ slug: i.slug }} className="block">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                      {capa ? (
                        <img src={publicUrl(capa)!} alt={i.titulo} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{FINALIDADE_LABEL[i.finalidade]}</span>
                      <span className="text-muted-foreground">{TIPO_LABEL[i.tipo]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">{i.titulo}</h3>
                    {(i.endereco_cidade || i.endereco_bairro) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[i.endereco_bairro, i.endereco_cidade && `${i.endereco_cidade}/${i.endereco_uf ?? ""}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {i.quartos != null && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{i.quartos}</span>}
                      {i.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{i.banheiros}</span>}
                      {i.area_util != null && <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{i.area_util} m²</span>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-bold text-primary">{formatBRL(i.preco)}</p>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(f.imovel_id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}