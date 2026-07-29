import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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
  const [form, setForm] = useState<SlaForm>(FORM_VAZIO);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
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
      sla_primeira_resposta_minutos: Number(form.slaRespostaMinutos) || 240,
      sla_resolucao_horas: Number(form.slaResolucaoHoras) || 48,
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

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Primeira resposta (minutos)
          </Label>
          <Input
            type="number"
            min={1}
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
