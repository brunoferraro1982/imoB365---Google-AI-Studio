import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, UserCircle2, Pencil, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/corretores/")({
  component: CorretoresList,
});

type Corretor = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  creci: string | null;
  creci_uf: string | null;
  foto_url: string | null;
  slug: string;
  ativo: boolean;
  publico: boolean;
  cargo: string | null;
};

function CorretoresList() {
  const [items, setItems] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("corretores")
      .select("id,nome,email,telefone,creci,creci_uf,foto_url,slug,ativo,publico,cargo")
      .order("nome");
    if (error) toast.error("Erro ao carregar: " + error.message);
    setItems((data as Corretor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este corretor?")) return;
    const { error } = await (supabase as any).from("corretores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Corretor excluído");
    load();
  }

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.creci ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Corretores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Equipe de corretores da imobiliária</p>
        </div>
        <Button asChild>
          <Link to="/app/corretores/novo"><Plus className="mr-2 h-4 w-4" /> Novo corretor</Link>
        </Button>
      </div>

      <div className="mt-6">
        <Input placeholder="Buscar por nome, CRECI ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <UserCircle2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "Nenhum corretor cadastrado ainda." : "Nenhum resultado."}
            </p>
            {items.length === 0 && (
              <Button asChild size="sm"><Link to="/app/corretores/novo">Cadastrar primeiro corretor</Link></Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3">CRECI</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.foto_url ? (
                        <img src={c.foto_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                      )}
                      <div>
                        <Link to="/app/corretores/$id" params={{ id: c.id }} className="font-medium hover:text-primary">{c.nome}</Link>
                        {c.cargo && <div className="text-xs text-muted-foreground">{c.cargo}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.creci ? `${c.creci}${c.creci_uf ? "/" + c.creci_uf : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{c.email ?? "—"}</div>
                    {c.telefone && <div className="text-xs">{c.telefone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {!c.ativo ? (
                      <Badge variant="secondary">Inativo</Badge>
                    ) : c.publico ? (
                      <Badge>Público</Badge>
                    ) : (
                      <Badge variant="outline">Ativo · interno</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {c.ativo && c.publico && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/corretor/${c.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/app/corretores/$id" params={{ id: c.id }}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}