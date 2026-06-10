import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FileText, Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/contratos/")({
  component: ContratosList,
});

const TIPO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  permuta: "Permuta",
  outro: "Outro",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default",
  rascunho: "secondary",
  encerrado: "outline",
  cancelado: "destructive",
};

function ContratosList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contratos")
      .select("id,numero,tipo,status,valor,data_inicio,data_fim,updated_at,imovel_id")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este contrato?")) return;
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contrato excluído");
    load();
  }

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.numero ?? "").toLowerCase().includes(q) || TIPO_LABEL[c.tipo]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jurídico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão de contratos de venda, locação, parceria e outros instrumentos jurídicos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/contratos/modelos">
            <Button variant="outline">
              <LayoutTemplate className="mr-2 h-4 w-4" /> Modelos
            </Button>
          </Link>
          <Link to="/app/contratos/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo contrato
            </Button>
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <Input
          placeholder="Buscar por número ou tipo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum contrato ainda.</p>
          <Link to="/app/contratos/novo" className="mt-4 inline-block">
            <Button size="sm">Criar primeiro contrato</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{c.numero ?? `#${c.id.slice(0, 8)}`}</td>
                  <td className="px-4 py-3">{TIPO_LABEL[c.tipo]}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{formatBRL(c.valor)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.data_inicio ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/app/contratos/$id" params={{ id: c.id }}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
