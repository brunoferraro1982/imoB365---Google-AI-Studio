import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/checklist")({
  component: ChecklistConfig,
});

const ETAPAS = ["proposta", "documentacao", "financiamento", "assinatura", "registro"];

function ChecklistConfig() {
  const { tenantId } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [novoTpl, setNovoTpl] = useState("");
  const [novoItem, setNovoItem] = useState({ template_id: "", etapa: "proposta", titulo: "" });

  async function load() {
    if (!tenantId) return;
    const { data: t } = await (supabase as any)
      .from("checklist_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nome");
    setTemplates(t ?? []);
    const { data: i } = await (supabase as any)
      .from("checklist_template_itens")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("ordem");
    setItens(i ?? []);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function addTpl() {
    if (!tenantId || !novoTpl.trim()) return;
    const { error } = await (supabase as any)
      .from("checklist_templates")
      .insert({ tenant_id: tenantId, nome: novoTpl, tipo: "venda" });
    if (error) return toast.error(error.message);
    setNovoTpl("");
    load();
  }

  async function delTpl(id: string) {
    if (!confirm("Remover modelo e todos os itens?")) return;
    await (supabase as any).from("checklist_templates").delete().eq("id", id);
    load();
  }

  async function addItem() {
    if (!tenantId || !novoItem.template_id || !novoItem.titulo.trim()) return;
    const ordem = itens.filter((x) => x.template_id === novoItem.template_id).length;
    const { error } = await (supabase as any).from("checklist_template_itens").insert({
      tenant_id: tenantId,
      template_id: novoItem.template_id,
      etapa: novoItem.etapa,
      titulo: novoItem.titulo,
      ordem,
    });
    if (error) return toast.error(error.message);
    setNovoItem({ ...novoItem, titulo: "" });
    load();
  }

  async function delItem(id: string) {
    await (supabase as any).from("checklist_template_itens").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Checklist de documentos</h1>
        <p className="text-sm text-muted-foreground">
          Modelos aplicados automaticamente aos contratos.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Modelos</h2>
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Nome do modelo (ex: Venda residencial)"
            value={novoTpl}
            onChange={(e) => setNovoTpl(e.target.value)}
          />
          <Button onClick={addTpl}>
            <Plus className="mr-1 h-4 w-4" /> Criar
          </Button>
        </div>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded border px-3 py-2">
              <span className="font-medium">{t.nome}</span>
              <Button size="sm" variant="ghost" onClick={() => delTpl(t.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Itens por modelo</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr,140px,2fr,auto]">
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm"
            value={novoItem.template_id}
            onChange={(e) => setNovoItem({ ...novoItem, template_id: e.target.value })}
          >
            <option value="">Modelo…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm"
            value={novoItem.etapa}
            onChange={(e) => setNovoItem({ ...novoItem, etapa: e.target.value })}
          >
            {ETAPAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Input
            placeholder="Documento (ex: RG do comprador)"
            value={novoItem.titulo}
            onChange={(e) => setNovoItem({ ...novoItem, titulo: e.target.value })}
          />
          <Button onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {templates.map((t) => {
          const tplItens = itens.filter((i) => i.template_id === t.id);
          if (tplItens.length === 0) return null;
          return (
            <div key={t.id} className="mb-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.nome}
              </h3>
              <ul className="space-y-1 text-sm">
                {tplItens.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded border px-3 py-1.5"
                  >
                    <span>
                      <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs">{i.etapa}</span>
                      {i.titulo}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => delItem(i.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
