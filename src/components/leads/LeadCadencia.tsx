import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { waLink } from "@/lib/whatsapp";
import { toast } from "sonner";

type Job = {
  id: string;
  cadencia_id: string;
  step_id: string;
  scheduled_at: string;
  status: string;
  resultado: string | null;
};

const CANAL: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail", ligacao: "Ligação" };

export function LeadCadencia({
  leadId,
  leadNome,
  telefone,
}: {
  leadId: string;
  leadNome: string;
  telefone: string | null;
}) {
  const { tenantId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [steps, setSteps] = useState<Record<string, any>>({});
  const [cads, setCads] = useState<any[]>([]);
  const [escolhida, setEscolhida] = useState("");

  async function load() {
    const [{ data: j }, { data: c }] = await Promise.all([
      (supabase as any)
        .from("lead_cadencia_jobs")
        .select("id,cadencia_id,step_id,scheduled_at,status,resultado")
        .eq("lead_id", leadId)
        .order("scheduled_at"),
      (supabase as any).from("lead_cadencias").select("id,nome").eq("ativo", true).order("nome"),
    ]);
    const stepIds = ((j as Job[]) ?? []).map((x) => x.step_id);
    let mapa: Record<string, any> = {};
    if (stepIds.length) {
      const { data: s } = await (supabase as any)
        .from("lead_cadencia_steps")
        .select("id,canal,template,assunto,ordem")
        .in("id", stepIds);
      mapa = Object.fromEntries((s ?? []).map((x: any) => [x.id, x]));
    }
    setJobs((j as Job[]) ?? []);
    setSteps(mapa);
    setCads(c ?? []);
  }
  useEffect(() => {
    if (tenantId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, tenantId]);

  async function aplicar() {
    if (!escolhida) return;
    const { data, error } = await (supabase as any).rpc("aplicar_cadencia_lead", {
      _lead: leadId,
      _cadencia: escolhida,
    });
    if (error) return toast.error(error.message);
    toast.success(
      data > 0 ? `${data} tarefa(s) criada(s).` : "Esta cadência já foi aplicada a este lead.",
    );
    setEscolhida("");
    load();
  }

  async function concluir(id: string) {
    const { error } = await (supabase as any).rpc("concluir_tarefa_cadencia", {
      _job: id,
      _resultado: null,
    });
    if (error) return toast.error(error.message);
    load();
  }

  function mensagem(template: string) {
    const primeiro = leadNome.split(" ")[0] ?? leadNome;
    return template.replace(/\{\{\s*nome\s*\}\}/g, primeiro);
  }

  const pendentes = jobs.filter((j) => j.status === "pendente");
  const feitas = jobs.filter((j) => j.status === "concluido").length;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Workflow className="h-4 w-4 text-primary" /> Cadência de follow-up
        </h3>
        <span className="text-xs text-muted-foreground">
          {pendentes.length} pendente(s) · {feitas} concluída(s)
        </span>
      </div>

      {pendentes.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">Nenhuma tarefa de cadência pendente.</p>
      )}

      <ul className="mb-4 space-y-2">
        {pendentes.map((j) => {
          const s = steps[j.step_id];
          if (!s) return null;
          const texto = mensagem(s.template);
          const link = s.canal === "whatsapp" ? waLink(telefone, texto) : null;
          return (
            <li key={j.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{CANAL[s.canal] ?? s.canal}</Badge>
                <span className="text-xs text-muted-foreground">
                  prazo {new Date(j.scheduled_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {s.assunto && <div className="font-medium">{mensagem(s.assunto)}</div>}
              <p className="whitespace-pre-wrap text-muted-foreground">{texto}</p>
              <div className="flex flex-wrap gap-2">
                {link && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={link} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-1 h-4 w-4" /> Abrir WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" onClick={() => concluir(j.id)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar como feita
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <select
          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={escolhida}
          onChange={(e) => setEscolhida(e.target.value)}
          aria-label="Cadência"
        >
          <option value="">Aplicar uma cadência…</option>
          {cads.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={aplicar} disabled={!escolhida}>
          Aplicar
        </Button>
      </div>
    </section>
  );
}
