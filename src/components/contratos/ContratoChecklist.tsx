import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

export function ContratoChecklist({
  contratoId,
  tenantId,
}: {
  contratoId: string;
  tenantId: string;
}) {
  const [itens, setItens] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplId, setTplId] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("contrato_checklist")
      .select("*")
      .eq("contrato_id", contratoId)
      .order("etapa")
      .order("ordem");
    setItens(data ?? []);
    const { data: t } = await (supabase as any)
      .from("checklist_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("ativo", true);
    setTemplates(t ?? []);
  }
  useEffect(() => {
    load();
  }, [contratoId, tenantId]);

  async function aplicarTemplate() {
    if (!tplId) return;
    const { data: tplItens } = await (supabase as any)
      .from("checklist_template_itens")
      .select("*")
      .eq("template_id", tplId)
      .order("ordem");
    if (!tplItens?.length) return toast.error("Modelo vazio");
    const rows = (tplItens as any[]).map((i: any) => ({
      tenant_id: tenantId,
      contrato_id: contratoId,
      etapa: i.etapa,
      titulo: i.titulo,
      obrigatorio: i.obrigatorio,
      ordem: i.ordem,
    }));
    const { error } = await (supabase as any).from("contrato_checklist").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Checklist aplicado");
    load();
  }

  async function toggle(it: any) {
    await (supabase as any)
      .from("contrato_checklist")
      .update({
        concluido: !it.concluido,
        concluido_em: !it.concluido ? new Date().toISOString() : null,
      })
      .eq("id", it.id);
    load();
  }

  const grupos = itens.reduce((acc: Record<string, any[]>, it) => {
    (acc[it.etapa] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {itens.length === 0 && (
        <div className="flex items-center gap-2">
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm"
            value={tplId}
            onChange={(e) => setTplId(e.target.value)}
          >
            <option value="">Escolha um modelo…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={aplicarTemplate} disabled={!tplId}>
            Aplicar checklist
          </Button>
        </div>
      )}
      {Object.entries(grupos).map(([etapa, lista]) => (
        <div key={etapa}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {etapa}
          </h4>
          <ul className="space-y-1 text-sm">
            {lista.map((i: any) => (
              <li key={i.id}>
                <button
                  onClick={() => toggle(i)}
                  className="flex w-full items-center gap-2 rounded border px-3 py-1.5 text-left hover:bg-muted"
                >
                  {i.concluido ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={i.concluido ? "line-through text-muted-foreground" : ""}>
                    {i.titulo}
                  </span>
                  {i.obrigatorio && !i.concluido && (
                    <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                      obrig.
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
