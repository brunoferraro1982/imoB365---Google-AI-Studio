import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { adicionarFavorito, removerFavorito, listarFavoritoIds } from "@/lib/favoritos.functions";
import { cn } from "@/lib/utils";

type Props = {
  imovelId: string;
  className?: string;
  size?: "sm" | "md";
};

// Module-level cache to avoid refetching across cards (per user)
let cachedIds: Set<string> | null = null;
let cachedUserId: string | null = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

export function invalidateFavoritosCache() {
  cachedIds = null;
  cachedUserId = null;
  notify();
}
export function addToFavoritosCache(imovelId: string) {
  cachedIds = cachedIds ?? new Set();
  cachedIds.add(imovelId);
  notify();
}
export function removeFromFavoritosCache(imovelId: string) {
  cachedIds?.delete(imovelId);
  notify();
}

export function FavoritoButton({ imovelId, className, size = "md" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const add = useServerFn(adicionarFavorito);
  const remove = useServerFn(removerFavorito);
  const list = useServerFn(listarFavoritoIds);
  const [favorito, setFavorito] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      if (cachedUserId !== null) {
        cachedIds = null;
        cachedUserId = null;
      }
      setFavorito(false);
      return;
    }
    // Reset cache if user changed
    if (cachedUserId !== user.id) {
      cachedIds = null;
      cachedUserId = user.id;
    }
    const sync = () => setFavorito(cachedIds?.has(imovelId) ?? false);
    listeners.add(sync);
    if (cachedIds) {
      sync();
    } else {
      list().then((r) => { cachedIds = new Set(r.ids); notify(); }).catch(() => {});
    }
    return () => { listeners.delete(sync); };
  }, [user, imovelId, list]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info("Faça login para favoritar.");
      navigate({ to: "/login" });
      return;
    }
    if (busy) return;
    setBusy(true);
    const wasFav = favorito;
    try {
      if (wasFav) {
        await remove({ data: { imovel_id: imovelId } });
        cachedIds?.delete(imovelId);
      } else {
        await add({ data: { imovel_id: imovelId } });
        cachedIds = cachedIds ?? new Set();
        cachedIds.add(imovelId);
      }
      notify();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur transition hover:bg-background",
        dim,
        className,
      )}
    >
      <Heart className={cn(icon, favorito ? "fill-red-500 text-red-500" : "text-foreground/70")} />
    </button>
  );
}