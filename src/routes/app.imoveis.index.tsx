import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building2, Pencil, Trash2, GitCompare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL, FINALIDADE_LABEL, STATUS_LABEL, TIPO_LABEL } from "@/lib/format";

export const Route = createFileRoute("/app/imoveis/")({
  component: ImoveisList,
});

type Imovel = {
  id: string;
  titulo: string;
  codigo_interno: string | null;
  finalidade: string;
  tipo: string;
  status: string;
  preco: number;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  publicado: boolean;
  updated_at: string;
};

function ImoveisList() {
  const [items, setItems] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imoveis")
      .select("id,titulo,codigo_interno,finalidade,tipo,status,preco,endereco_cidade,endereco_uf,publicado,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar imóveis: " + error.message);
    setItems((data as Imovel[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este imóvel? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Imóvel excluído");
    load();
  }

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.titulo.toLowerCase().includes(q) ||
      (i.codigo_interno ?? "").toLowerCase().includes(q) ||
      (i.endereco_cidade ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catálogo da sua imobiliária</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/imoveis/comparar"><GitCompare className="mr-2 h-4 w-4" /> Comparar</Link>
          </Button>
          <Button asChild>
            <Link to="/app/imoveis/novo"><Plus className="mr-2 h-4 w-4" /> Novo imóvel</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Input
          placeholder="Buscar por título, código ou cidade…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "Nenhum imóvel cadastrado ainda." : "Nenhum resultado para a busca."}
            </p>
            {items.length === 0 && (
              <Button asChild size="sm">
                <Link to="/app/imoveis/novo">Cadastrar primeiro imóvel</Link>
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Imóvel</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Finalidade</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/app/imoveis/$id" params={{ id: i.id }} className="font-medium hover:text-primary">
                      {i.titulo}
                    </Link>
                    {i.codigo_interno && <div className="text-xs text-muted-foreground">#{i.codigo_interno}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[i.tipo] ?? i.tipo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {i.endereco_cidade ? `${i.endereco_cidade}${i.endereco_uf ? "/" + i.endereco_uf : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatBRL(i.preco)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.publicado && i.status === "ativo" ? "default" : "secondary"}>
                      {STATUS_LABEL[i.status] ?? i.status}
                      {i.publicado && i.status === "ativo" ? " · publicado" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/app/imoveis/$id" params={{ id: i.id }}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>
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