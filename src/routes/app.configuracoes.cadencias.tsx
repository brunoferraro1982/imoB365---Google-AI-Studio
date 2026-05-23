import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/cadencias")({
  component: CadenciasPage,
});

function CadenciasPage() {
  const { tenantId } = useAuth();
  const [cads, setCads] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [novo, setNovo] = useState("");

  async function load() {
    if (!tenantId) return;
    const [{ data: c }, { data: s }] = await Promise.all([
      (supabase as any).from("lead_cadencias").select("*").eq("tenant_id", tenantId).order("created_at"),
      (supabase as any).from("lead_cadencia_steps").select("*").eq("tenant_id", tenantId).order("ordem"),
    ]);
    setCads(c ?? []); setSteps(s ?? []);
    if (!sel && c?.[0]) setSel(c[0].id);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function addCad() {
    if (!novo.trim() || !tenantId) return;
    const { error } = await (supabase as any).from("lead_cadencias").insert({ tenant_id: tenantId, nome: novo.trim() });
    if (error) return toast.error(error.message);
    setNovo(""); load();
  }

  async function addStep() {
    if (!sel || !tenantId) return;
    const ordem = steps.filter((s) => s.cadencia_id === sel).length;
    const { error } = await (supabase as any).from("lead_cadencia_steps").insert({
      tenant_id: tenantId, cadencia_id: sel, ordem,
      canal: "whatsapp", delay_horas: 24, template: "Olá {{nome}}, tudo bem?",
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function patchStep(id: string, patch: any) {
    await (supabase as any).from("lead_cadencia_steps").update(patch).eq("id", id);
    load();
  }

  async function delStep(id: string) {
    await (supabase as any).from("lead_cadencia_steps").delete().eq("id", id);
    load();
  }

  const mySteps = steps.filter((s) => s.cadencia_id === sel);

  return (
    <div className="max-w-5xl space-y-6 p-8">
      <header className="flex items-center gap-3">
        <Workflow className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Cadências de follow-up</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Sequências programadas de mensagens (WhatsApp, e-mail, ligação) que o corretor pode aplicar a um lead. Use <code>{"{{nome}}"}</code> para personalizar.
      </p>
      <div className="grid gap-6 md:grid-cols-[260px,1fr]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Cadências</h2>
          <ul className="space-y-1">
            {cads.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSel(c.id)} className={`w-full rounded px-2 py-1.5 text-left text-sm ${sel === c.id ? "bg-muted" : "hover:bg-muted/50"}`}>
                  {c.nome}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova cadência" />
            <Button size="sm" onClick={addCad}><Plus className="h-4 w-4" /></Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Passos</h2>
            <Button size="sm" onClick={addStep} disabled={!sel}><Plus className="mr-1 h-4 w-4" /> Passo</Button>
          </div>
          <ul className="space-y-3">
            {mySteps.map((s, i) => (
              <li key={s.id} className="rounded border p-3 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold">#{i + 1}</span>
                  <select className="rounded border bg-background px-2 py-1 text-xs" defaultValue={s.canal} onChange={(e) => patchStep(s.id, { canal: e.target.value })}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="ligacao">Ligação</option>
                  </select>
                  <Input className="w-28" type="number" defaultValue={s.delay_horas} onBlur={(e) => patchStep(s.id, { delay_horas: Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">horas após o anterior</span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => delStep(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input className="mb-2" defaultValue={s.assunto ?? ""} placeholder="Assunto (opcional)" onBlur={(e) => patchStep(s.id, { assunto: e.target.value || null })} />
                <Textarea rows={3} defaultValue={s.template} onBlur={(e) => patchStep(s.id, { template: e.target.value })} />
              </li>
            ))}
            {mySteps.length === 0 && <li className="text-sm text-muted-foreground">Adicione passos para esta cadência.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}