import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Info, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/cadencias")({
  component: CadenciasPage,
});

const CANAIS: Record<string, string> = {
  whatsapp: "WhatsApp (abre a conversa pronta)",
  email: "E-mail (texto para copiar)",
  ligacao: "Ligação (tarefa para o corretor)",
};

function CadenciasPage() {
  const { tenantId } = useAuth();
  const [cads, setCads] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [funis, setFunis] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [novo, setNovo] = useState("");

  async function load() {
    if (!tenantId) return;
    const [{ data: c }, { data: s }, { data: e }, { data: f }] = await Promise.all([
      (supabase as any)
        .from("lead_cadencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at"),
      (supabase as any)
        .from("lead_cadencia_steps")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem"),
      (supabase as any)
        .from("lead_funil_etapas")
        .select("id,nome,funil_id,ordem")
        .eq("tenant_id", tenantId)
        .order("ordem"),
      (supabase as any).from("lead_funis").select("id,nome").eq("tenant_id", tenantId),
    ]);
    setCads(c ?? []);
    setSteps(s ?? []);
    setEtapas(e ?? []);
    setFunis(f ?? []);
    setSel((atual) => atual ?? c?.[0]?.id ?? null);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function addCad() {
    if (!novo.trim() || !tenantId) return;
    const { data, error } = await (supabase as any)
      .from("lead_cadencias")
      .insert({ tenant_id: tenantId, nome: novo.trim() })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNovo("");
    setSel(data.id);
    load();
  }

  async function patchCad(id: string, patch: any) {
    const { error } = await (supabase as any).from("lead_cadencias").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    load();
  }

  async function addStep() {
    if (!sel || !tenantId) return;
    const ordem = steps.filter((s) => s.cadencia_id === sel).length + 1;
    const { error } = await (supabase as any).from("lead_cadencia_steps").insert({
      tenant_id: tenantId,
      cadencia_id: sel,
      ordem,
      canal: "whatsapp",
      delay_horas: 24,
      template: "Olá {{nome}}, tudo bem?",
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function patchStep(id: string, patch: any) {
    const { error } = await (supabase as any)
      .from("lead_cadencia_steps")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
    load();
  }

  async function delStep(id: string) {
    await (supabase as any).from("lead_cadencia_steps").delete().eq("id", id);
    load();
  }

  const cadSel = cads.find((c) => c.id === sel);
  const mySteps = steps.filter((s) => s.cadencia_id === sel);
  const nomeEtapa = (id: string | null) => {
    const e = etapas.find((x) => x.id === id);
    if (!e) return "";
    const f = funis.find((x) => x.id === e.funil_id);
    return f ? `${e.nome} (${f.nome})` : e.nome;
  };

  return (
    <div className="max-w-5xl space-y-6 p-8">
      <Link
        to="/app/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Leads
      </Link>
      <header className="flex items-center gap-3">
        <Workflow className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Cadências de follow-up</h1>
      </header>
      <div className="flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Aplicar uma cadência a um lead cria <b>tarefas na ficha do lead</b>, com prazo e texto
          prontos. O corretor envia cada uma e marca como concluída.{" "}
          <b>O envio automático ainda não existe.</b> Se a cadência tiver uma etapa de disparo, ela
          é aplicada sozinha quando o lead entra nessa etapa. Use <code>{"{{nome}}"}</code> para
          personalizar.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px,1fr]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Cadências</h2>
          <ul className="space-y-1">
            {cads.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSel(c.id)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${sel === c.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  {c.nome}
                  {!c.ativo && (
                    <span className="ml-1 text-xs text-muted-foreground">(inativa)</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Nova cadência"
            />
            <Button size="sm" onClick={addCad} aria-label="Criar cadência">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4">
          {!cadSel ? (
            <p className="text-sm text-muted-foreground">Crie uma cadência para começar.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Aplicar automaticamente ao entrar na etapa
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={cadSel.trigger_etapa_id ?? ""}
                    onChange={(e) =>
                      patchCad(cadSel.id, { trigger_etapa_id: e.target.value || null })
                    }
                  >
                    <option value="">Não aplicar automaticamente</option>
                    {etapas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {nomeEtapa(e.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cadSel.ativo}
                    onChange={(e) => patchCad(cadSel.id, { ativo: e.target.checked })}
                  />
                  Cadência ativa
                </label>
              </div>
              {cadSel.trigger_etapa_id && (
                <p className="text-xs text-muted-foreground">
                  Atual: {nomeEtapa(cadSel.trigger_etapa_id)}. Leads que já tiverem a cadência não
                  recebem tarefas duplicadas.
                </p>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Passos</h2>
                <Button size="sm" onClick={addStep}>
                  <Plus className="mr-1 h-4 w-4" /> Passo
                </Button>
              </div>
              <ul className="space-y-3">
                {mySteps.map((s, i) => (
                  <li key={s.id} className="space-y-2 rounded border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold">#{i + 1}</span>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                        value={s.canal}
                        onChange={(e) => patchStep(s.id, { canal: e.target.value })}
                        aria-label="Canal"
                      >
                        {Object.entries(CANAIS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <Input
                        className="w-24"
                        type="number"
                        defaultValue={s.delay_horas}
                        onBlur={(e) => patchStep(s.id, { delay_horas: Number(e.target.value) })}
                        aria-label="Horas após o passo anterior"
                      />
                      <span className="text-xs text-muted-foreground">horas após o anterior</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => delStep(s.id)}
                        aria-label="Excluir passo"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      defaultValue={s.assunto ?? ""}
                      placeholder="Assunto (opcional, usado no e-mail)"
                      onBlur={(e) => patchStep(s.id, { assunto: e.target.value || null })}
                    />
                    <Textarea
                      rows={3}
                      defaultValue={s.template}
                      onBlur={(e) => patchStep(s.id, { template: e.target.value })}
                    />
                  </li>
                ))}
                {mySteps.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Adicione passos para esta cadência.
                  </li>
                )}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
