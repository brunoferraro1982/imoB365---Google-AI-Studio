import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/scoring")({
  component: ScoringPage,
});

const EVENTOS = [
  "lead.criado", "lead.contatado", "lead.visita_marcada",
  "lead.visita_realizada", "lead.proposta", "lead.email_aberto",
  "lead.whatsapp_respondido",
];

function ScoringPage() {
  const { tenantId } = useAuth();
  const [regras, setRegras] = useState<any[]>([]);
  const [evento, setEvento] = useState(EVENTOS[0]);
  const [pontos, setPontos] = useState(10);

  async function load() {
    if (!tenantId) return;
    const { data } = await (supabase as any).from("lead_scoring_regras").select("*").eq("tenant_id", tenantId).order("evento");
    setRegras(data ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function add() {
    if (!tenantId) return;
    const { error } = await (supabase as any).from("lead_scoring_regras").insert({ tenant_id: tenantId, evento, pontos });
    if (error) return toast.error(error.message);
    load();
  }

  async function del(id: string) {
    await (supabase as any).from("lead_scoring_regras").delete().eq("id", id);
    load();
  }

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <header className="flex items-center gap-3">
        <Target className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Lead scoring</h1>
      </header>
      <p className="text-sm text-muted-foreground">Atribua pontos a eventos do lead. O score acumulado aparece na ficha e ajuda a priorizar follow-ups.</p>
      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-[1fr,120px,auto] gap-2">
          <select className="rounded border bg-background px-2 text-sm" value={evento} onChange={(e) => setEvento(e.target.value)}>
            {EVENTOS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
          <Input type="number" value={pontos} onChange={(e) => setPontos(Number(e.target.value))} />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </div>
        <ul className="mt-4 space-y-1">
          {regras.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span><b className="mr-2">+{r.pontos}</b>{r.evento}</span>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
          {regras.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</li>}
        </ul>
      </div>
    </div>
  );
}