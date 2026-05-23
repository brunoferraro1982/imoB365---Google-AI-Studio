import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarBuscas, removerBusca, toggleAlertaBusca } from "@/lib/buscas-salvas.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bookmark, Search as SearchIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/buscas")({
  head: () => ({ meta: [{ title: "Minhas buscas — imob365" }] }),
  component: MinhasBuscasPage,
});

type Busca = {
  id: string;
  nome: string;
  filtros: Record<string, any>;
  alerta_email: boolean;
  ultimo_envio: string | null;
  created_at: string;
};

function MinhasBuscasPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const listar = useServerFn(listarBuscas);
  const remover = useServerFn(removerBusca);
  const toggle = useServerFn(toggleAlertaBusca);
  const [items, setItems] = useState<Busca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    listar()
      .then((r) => setItems(r.buscas as Busca[]))
      .catch((e: any) => toast.error(e?.message ?? "Erro"))
      .finally(() => setLoading(false));
  }, [user, authLoading, listar, navigate]);

  async function handleRemove(id: string) {
    try {
      await remover({ data: { id } });
      setItems((p) => p.filter((b) => b.id !== id));
      toast.success("Busca removida");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function handleToggle(b: Busca, value: boolean) {
    try {
      await toggle({ data: { id: b.id, alerta_email: value } });
      setItems((p) => p.map((x) => x.id === b.id ? { ...x, alerta_email: value } : x));
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  function resumo(f: Record<string, any>) {
    const parts: string[] = [];
    if (f.q) parts.push(`"${f.q}"`);
    if (f.finalidade && f.finalidade !== "todos") parts.push(f.finalidade);
    if (f.tipo) parts.push(f.tipo);
    if (f.bairro) parts.push(`Bairro: ${f.bairro}`);
    if (f.quartos) parts.push(`${f.quartos}+ quartos`);
    if (f.vagas) parts.push(`${f.vagas}+ vagas`);
    if (f.precoMin || f.precoMax) parts.push(`R$ ${f.precoMin || "0"}–${f.precoMax || "∞"}`);
    if (f.areaMin) parts.push(`≥ ${f.areaMin}m²`);
    return parts.join(" · ") || "Sem filtros";
  }

  function searchParams(f: Record<string, any>) {
    const sp: Record<string, string> = {};
    for (const k of ["q","finalidade","tipo","bairro","quartos","banheiros","vagas","areaMin","precoMin","precoMax"]) {
      if (f[k]) sp[k] = String(f[k]);
    }
    return sp as any;
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Minhas buscas</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Receba alertas por e-mail quando novos imóveis combinarem com suas preferências.</p>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não salvou nenhuma busca.</p>
            <Link to="/buscar"><Button className="mt-4">Buscar imóveis</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight">{b.nome}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{resumo(b.filtros)}</p>
                    {b.ultimo_envio && (
                      <p className="mt-1 text-xs text-muted-foreground">Último alerta: {new Date(b.ultimo_envio).toLocaleString("pt-BR")}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Alerta por e-mail</span>
                      <Switch checked={b.alerta_email} onCheckedChange={(v) => handleToggle(b, v)} />
                    </label>
                    <Link to="/buscar" search={searchParams(b.filtros)}>
                      <Button size="sm" variant="outline"><SearchIcon className="mr-1.5 h-4 w-4" />Abrir</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(b.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}