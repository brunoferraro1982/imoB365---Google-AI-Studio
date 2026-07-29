import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// plans.slug reais (confirmado contra dev): "pro"/"business", sem prefixo
// "plan-" — mesma convenção já usada em app.leads.captacao.tsx.
const PLANOS_COM_ACESSO = ["pro", "business"];

// SLA por tenant (item #3 do pedido original) — tenant_atendimento_config
// já existe desde o Sprint 0; esta tela expõe os campos pro admin do
// tenant editar. Sem config própria, o trigger tg_chamado_sla (Sprint 6)
// usa um default fixo de 4h/48h — mesmo padrão de "default no código,
// sem exigir linha de config" já usado em SLA_CARTORIO_DIAS.
type SlaForm = {
  slaRespostaMinutos: string;
  slaResolucaoHoras: string;
  roundRobinAtivo: boolean;
};

const FORM_VAZIO: SlaForm = {
  slaRespostaMinutos: "240",
  slaResolucaoHoras: "48",
  roundRobinAtivo: true,
};

export function AtendimentoSlaSection() {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existe, setExiste] = useState(false);
  const [planoOk, setPlanoOk] = useState(false);
  const [form, setForm] = useState<SlaForm>(FORM_VAZIO);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data: tenant } = await supabase
      .from("tenants")
      .select("plano_slug")
      .eq("id", tenantId)
      .maybeSingle();
    setPlanoOk(PLANOS_COM_ACESSO.includes((tenant as { plano_slug?: string })?.plano_slug ?? ""));

    const { data } = await supabase
      .from("tenant_atendimento_config")
      .select("sla_primeira_resposta_minutos,sla_resolucao_horas,round_robin_ativo")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) {
      setExiste(true);
      setForm({
        slaRespostaMinutos: String(data.sla_primeira_resposta_minutos),
        slaResolucaoHoras: String(data.sla_resolucao_horas),
        roundRobinAtivo: data.round_robin_ativo,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      // Planos abaixo de Pro/Business não podem customizar os prazos —
      // força o default mesmo que o form tenha sido adulterado, já que os
      // inputs ficam desabilitados na UI só pra esses planos.
      sla_primeira_resposta_minutos: planoOk ? Number(form.slaRespostaMinutos) || 240 : 240,
      sla_resolucao_horas: planoOk ? Number(form.slaResolucaoHoras) || 48 : 48,
      round_robin_ativo: form.roundRobinAtivo,
    };
    const { error } = existe
      ? await supabase.from("tenant_atendimento_config").update(payload).eq("tenant_id", tenantId)
      : await supabase.from("tenant_atendimento_config").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SLA salvo");
    setExiste(true);
    load();
  }

  if (loading) return null;

  return (
    <form
      onSubmit={salvar}
      className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-base font-semibold">SLA de atendimento</h2>
      <p className="text-xs text-muted-foreground">
        Prazo que sua equipe se compromete a cumprir ao responder e resolver um chamado. Sem
        configurar, vale o padrão de 4h para a primeira resposta e 48h para resolução.
      </p>
      {!planoOk && (
        <p className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Personalizar esses prazos é um recurso dos planos <strong>Pro</strong> e{" "}
          <strong>Business</strong> — no seu plano atual vale o padrão fixo abaixo, mas os chamados
          continuam sendo recebidos e respondidos normalmente.{" "}
          <a href="/app/contratacao" className="font-medium text-primary underline">
            Ver planos
          </a>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Primeira resposta (minutos)
          </Label>
          <Input
            type="number"
            min={1}
            disabled={!planoOk}
            value={form.slaRespostaMinutos}
            onChange={(e) => setForm((f) => ({ ...f, slaRespostaMinutos: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Resolução (horas)
          </Label>
          <Input
            type="number"
            min={1}
            disabled={!planoOk}
            value={form.slaResolucaoHoras}
            onChange={(e) => setForm((f) => ({ ...f, slaResolucaoHoras: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
        <div>
          <Label htmlFor="sla-round-robin" className="text-sm">
            Distribuir chamados automaticamente entre a equipe
          </Label>
          <p className="text-xs text-muted-foreground">
            Round robin — cada novo chamado é atribuído em sequência a admin/atendente/broker.
          </p>
        </div>
        <Switch
          id="sla-round-robin"
          checked={form.roundRobinAtivo}
          onCheckedChange={(v) => setForm((f) => ({ ...f, roundRobinAtivo: v }))}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
