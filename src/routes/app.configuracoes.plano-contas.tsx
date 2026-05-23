import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/plano-contas")({ component: PlanoContas });

function PlanoContas() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [novo, setNovo] = useState({ codigo: "", nome: "", tipo: "despesa" });

  async function load() {
    if (!tenantId) return;
    const { data } = await (supabase as any).from("plano_contas").select("*").eq("tenant_id", tenantId).order("codigo");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function add() {
    if (!tenantId || !novo.codigo.trim() || !novo.nome.trim()) return;
    const { error } = await (supabase as any).from("plano_contas").insert({ tenant_id: tenantId, ...novo });
    if (error) return toast.error(error.message);
    setNovo({ codigo: "", nome: "", tipo: "despesa" }); load();
  }
  async function del(id: string) { await (supabase as any).from("plano_contas").delete().eq("id", id); load(); }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Plano de contas</h1>
        <p className="text-sm text-muted-foreground">Categorize receitas e despesas para relatórios contábeis.</p>
      </div>
      <section className="rounded-xl border bg-card p-6">
        <div className="mb-3 grid gap-2 sm:grid-cols-[100px,1fr,140px,auto]">
          <Input placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          <Input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <select className="rounded border bg-background px-2 py-1.5 text-sm" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Código</th><th className="text-left">Nome</th><th>Tipo</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td>{r.codigo}</td><td>{r.nome}</td>
                <td className="text-center"><span className={`rounded px-2 py-0.5 text-xs ${r.tipo === "receita" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{r.tipo}</span></td>
                <td><Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">Nenhuma conta cadastrada.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}