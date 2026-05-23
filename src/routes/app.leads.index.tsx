import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Users, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/")({
  component: LeadsKanban,
});

type Lead = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  mensagem: string | null;
  origem: string;
  status: "novo" | "contato" | "visita" | "proposta" | "ganho" | "perdido";
  imovel_id: string | null;
  corretor_id: string | null;
  created_at: string;
};

const COLUNAS: { key: Lead["status"]; label: string; tone: string }[] = [
  { key: "novo", label: "Novos", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  { key: "contato", label: "Em contato", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { key: "visita", label: "Visita", tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { key: "proposta", label: "Proposta", tone: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  { key: "ganho", label: "Ganho", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { key: "perdido", label: "Perdido", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
];

function LeadsKanban() {
  const [items, setItems] = useState<Lead[]>([]);
  const [corretores, setCorretores] = useState<Record<string, string>>({});
  const [imoveis, setImoveis] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: leads, error }, { data: cors }, { data: imos }] = await Promise.all([
      (supabase as any).from("leads").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("corretores").select("id,nome"),
      (supabase as any).from("imoveis").select("id,titulo"),
    ]);
    if (error) toast.error(error.message);
    setItems((leads as Lead[]) ?? []);
    setCorretores(Object.fromEntries((cors ?? []).map((c: any) => [c.id, c.nome])));
    setImoveis(Object.fromEntries((imos ?? []).map((i: any) => [i.id, i.titulo])));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function moveTo(id: string, status: Lead["status"]) {
    const prev = items.find((l) => l.id === id);
    if (!prev || prev.status === status) return;
    setItems((arr) => arr.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await (supabase as any).from("leads").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); load(); return; }
    await (supabase as any).from("lead_interacoes").insert({
      lead_id: id, tenant_id: prev ? (prev as any).tenant_id ?? null : null,
      tipo: "mudanca_etapa", conteudo: `${prev.status} → ${status}`,
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((l) =>
      l.nome.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.telefone ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Funil de atendimento — arraste para mudar a etapa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/leads/configuracao"><Settings2 className="mr-2 h-4 w-4" /> Distribuição</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Input placeholder="Buscar por nome, e-mail, telefone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum lead recebido ainda. Eles aparecem aqui assim que alguém envia uma mensagem pelo site.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
          {COLUNAS.map((col) => {
            const cards = filtered.filter((l) => l.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) { moveTo(dragId, col.key); setDragId(null); } }}
                className="flex min-h-[200px] flex-col rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${col.tone}`}>{col.label}</span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((l) => (
                    <Link
                      key={l.id}
                      to="/app/leads/$id"
                      params={{ id: l.id }}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      className="block cursor-grab rounded-lg border border-border bg-card p-3 text-sm shadow-sm hover:border-primary/40"
                    >
                      <div className="font-medium">{l.nome}</div>
                      {l.imovel_id && imoveis[l.imovel_id] && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{imoveis[l.imovel_id]}</div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
                        {l.corretor_id && corretores[l.corretor_id] && (
                          <Badge variant="outline" className="text-[10px]">{corretores[l.corretor_id]}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}