import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/empreendimentos/")({
  component: EmpreendimentosPage,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function EmpreendimentosPage() {
  const { tenantId } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [nome, setNome] = useState("");

  async function load() {
    if (!tenantId) return;
    const { data } = await (supabase as any).from("empreendimentos").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    setList(data ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function criar() {
    if (!nome.trim() || !tenantId) return;
    const { error } = await (supabase as any).from("empreendimentos").insert({
      tenant_id: tenantId, nome: nome.trim(), slug: slugify(nome) + "-" + Math.random().toString(36).slice(2, 6),
    });
    if (error) return toast.error(error.message);
    setNome(""); load();
  }

  async function del(id: string) {
    if (!confirm("Excluir empreendimento e todas as unidades?")) return;
    await (supabase as any).from("empreendimentos").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Empreendimentos / Lançamentos</h1>
        </div>
      </header>

      <div className="flex gap-2">
        <Input placeholder="Nome do empreendimento" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button onClick={criar}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
      </div>

      <ul className="space-y-2">
        {list.map((e) => (
          <li key={e.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <Link to="/app/empreendimentos/$id" params={{ id: e.id }} className="font-semibold hover:underline">{e.nome}</Link>
              <div className="text-xs text-muted-foreground">Fase: {e.fase} {e.publicado ? "· publicado" : ""}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted-foreground">Nenhum empreendimento cadastrado.</li>}
      </ul>
    </div>
  );
}