import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listarFavoritos,
  removerFavorito,
  atualizarFavoritoPasta,
} from "@/lib/favoritos.functions";
import { removeFromFavoritosCache } from "@/components/FavoritoButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { MapPin, Bed, Bath, Maximize2, Heart, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conta/favoritos")({
  head: () => ({ meta: [{ title: "Meus favoritos — imob365" }] }),
  component: FavoritosPage,
});

const PASTA_PRESETS = ["Para visitar", "Comparar", "Descartado"];
const SEM_PASTA = "__sem_pasta__";

function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const listar = useServerFn(listarFavoritos);
  const remover = useServerFn(removerFavorito);
  const atualizarPasta = useServerFn(atualizarFavoritoPasta);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
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

  async function handlePastaChange(imovelId: string, value: string) {
    const pasta = value === SEM_PASTA ? null : value;
    const anterior = items.find((f) => f.imovel_id === imovelId)?.pasta ?? null;
    setItems((prev) => prev.map((f) => (f.imovel_id === imovelId ? { ...f, pasta } : f)));
    try {
      await atualizarPasta({ data: { imovel_id: imovelId, pasta } });
    } catch (e: any) {
      setItems((prev) =>
        prev.map((f) => (f.imovel_id === imovelId ? { ...f, pasta: anterior } : f)),
      );
      toast.error(e?.message ?? "Erro ao atualizar pasta");
    }
  }

  const pastaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of items) {
      const key = f.pasta ?? SEM_PASTA;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const itemsFiltrados =
    filtro === null ? items : items.filter((f) => (f.pasta ?? SEM_PASTA) === filtro);

  const filtros: { key: string | null; label: string }[] = [
    { key: null, label: "Todos" },
    ...PASTA_PRESETS.map((p) => ({ key: p, label: p })),
    { key: SEM_PASTA, label: "Sem pasta" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2">
        <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        <h1 className="text-3xl font-bold tracking-tight">Meus favoritos</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Imóveis que você salvou para acompanhar.</p>

      {items.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {filtros.map((f) => {
            const count = f.key === null ? items.length : (pastaCounts.get(f.key) ?? 0);
            if (f.key !== null && count === 0) return null;
            const active = filtro === f.key;
            return (
              <button
                key={f.key ?? "todos"}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não favoritou nenhum imóvel.</p>
            <Link to="/buscar">
              <Button className="mt-4">Buscar imóveis</Button>
            </Link>
          </div>
        ) : itemsFiltrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum favorito nessa pasta.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {itemsFiltrados.map((f: any) => {
              const i = f.imoveis;
              if (!i) return null;
              const fotos = (i.imovel_fotos ?? [])
                .slice()
                .sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
              const capa = fotos[0]?.storage_path ?? null;
              return (
                <div
                  key={f.id}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg"
                >
                  <Link to="/imovel/$slug" params={{ slug: i.slug }} className="block">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                      {capa ? (
                        <img
                          src={publicUrl(capa)!}
                          alt={i.titulo}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Sem foto
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {FINALIDADE_LABEL[i.finalidade]}
                      </span>
                      <span className="text-muted-foreground">{TIPO_LABEL[i.tipo]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">{i.titulo}</h3>
                    {(i.endereco_cidade || i.endereco_bairro) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[
                          i.endereco_bairro,
                          i.endereco_cidade && `${i.endereco_cidade}/${i.endereco_uf ?? ""}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {i.quartos != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3 w-3" />
                          {i.quartos}
                        </span>
                      )}
                      {i.banheiros != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3 w-3" />
                          {i.banheiros}
                        </span>
                      )}
                      {i.area_util != null && (
                        <span className="flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" />
                          {i.area_util} m²
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-primary">{formatBRL(i.preco)}</p>
                      <div className="flex items-center gap-1">
                        <Select
                          value={f.pasta ?? SEM_PASTA}
                          onValueChange={(v) => handlePastaChange(f.imovel_id, v)}
                        >
                          <SelectTrigger className="h-8 w-[132px] gap-1 text-xs [&>svg]:h-3 [&>svg]:w-3">
                            <Tag className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <SelectValue placeholder="Pasta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_PASTA}>Sem pasta</SelectItem>
                            {PASTA_PRESETS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(f.imovel_id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
