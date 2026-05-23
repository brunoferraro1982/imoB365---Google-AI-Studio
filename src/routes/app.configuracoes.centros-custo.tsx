import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/centros-custo")({ component: CentrosCusto });

function CentrosCusto() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [novo, setNovo] = useState({ codigo: "", nome: "" });

  async function load() {
    if (!tenantId) return;
    const { data } = await (supabase as any).from("centros_custo").select("*").eq("tenant_id", tenantId).order("codigo");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function add() {
    if (!tenantId || !novo.codigo.trim() || !novo.nome.trim()) return;
    const { error } = await (supabase as any).from("centros_custo").insert({ tenant_id: tenantId, ...novo });
    if (error) return toast.error(error.message);
    setNovo({ codigo: "", nome: "" }); load();
  }
  async function del(id: string) { await (supabase as any).from("centros_custo").delete().eq("id", id); load(); }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Centros de custo</h1>
        <p className="text-sm text-muted-foreground">Agrupe lançamentos por filial, equipe ou projeto.</p>
      </div>
      <section className="rounded-xl border bg-card p-6">
        <div className="mb-3 grid gap-2 sm:grid-cols-[100px,1fr,auto]">
          <Input placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          <Input placeholder="Nome (ex: Matriz, Filial SP)" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
              <span><span className="mr-2 font-mono text-xs text-muted-foreground">{r.codigo}</span>{r.nome}</span>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </li>
          ))}
          {rows.length === 0 && <p className="py-3 text-center text-muted-foreground">Nenhum centro de custo.</p>}
        </ul>
      </section>
    </div>
  );
}