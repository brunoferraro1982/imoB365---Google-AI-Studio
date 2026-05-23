import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Banknote, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/financeiro/")({
  component: FinanceiroList,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", pago: "Pago", atrasado: "Atrasado", cancelado: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pago: "default", pendente: "secondary", atrasado: "destructive", cancelado: "outline",
};

function FinanceiroList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "receita" | "despesa">("todos");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lancamentos_financeiros")
      .select("id,tipo,categoria,descricao,valor,data_vencimento,data_pagamento,status")
      .order("data_vencimento", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lançamento excluído");
    load();
  }

  const filtered = items.filter((l) => {
    if (filter !== "todos" && l.tipo !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.descricao.toLowerCase().includes(q) || (l.categoria ?? "").toLowerCase().includes(q);
  });

  const totals = useMemo(() => {
    let receitas = 0, despesas = 0, pendentes = 0;
    for (const l of items) {
      if (l.status === "cancelado") continue;
      const v = Number(l.valor) || 0;
      if (l.tipo === "receita") receitas += v; else despesas += v;
      if (l.status === "pendente" || l.status === "atrasado") pendentes += v * (l.tipo === "receita" ? 1 : -1);
    }
    return { receitas, despesas, saldo: receitas - despesas, pendentes };
  }, [items]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Receitas, despesas e fluxo de caixa.</p>
        </div>
        <Link to="/app/financeiro/novo">
          <Button><Plus className="mr-2 h-4 w-4" /> Novo lançamento</Button>
        </Link>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Stat label="Receitas" value={formatBRL(totals.receitas)} icon={TrendingUp} className="text-emerald-600" />
        <Stat label="Despesas" value={formatBRL(totals.despesas)} icon={TrendingDown} className="text-red-600" />
        <Stat label="Saldo" value={formatBRL(totals.saldo)} icon={Banknote} className={totals.saldo >= 0 ? "text-emerald-600" : "text-red-600"} />
        <Stat label="Em aberto" value={formatBRL(totals.pendentes)} icon={Banknote} className="text-amber-600" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        {(["todos", "receita", "despesa"] as const).map((f) => (
          <Button key={f} type="button" variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : f === "receita" ? "Receitas" : "Despesas"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Banknote className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum lançamento.</p>
          <Link to="/app/financeiro/novo" className="mt-4 inline-block"><Button size="sm">Criar primeiro lançamento</Button></Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Vencimento</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{l.descricao}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.categoria ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.data_vencimento}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[l.status] ?? "secondary"}>{STATUS_LABEL[l.status]}</Badge></td>
                  <td className={`px-4 py-3 text-right font-medium ${l.tipo === "receita" ? "text-emerald-600" : "text-red-600"}`}>
                    {l.tipo === "receita" ? "+" : "−"} {formatBRL(l.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/app/financeiro/$id" params={{ id: l.id }}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
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

function Stat({ label, value, icon: Icon, className }: { label: string; value: string; icon: any; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${className ?? ""}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}