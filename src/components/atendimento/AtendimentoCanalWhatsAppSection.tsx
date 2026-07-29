import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// BYO por tenant, mesmo princípio do canal de e-mail (ver memória
// "imob365-tenant-autonomy-byo-credentials"): a imoB365 não hospeda uma
// instância compartilhada do Evolution API pra todo mundo — cada
// imobiliária traz a própria instância (self-hosted ou de um provedor à
// escolha dela) e só informa a URL/API key aqui. A imoB365 nunca vê ou
// opera o número de WhatsApp do tenant.
type ConfigForm = {
  instanceUrl: string;
  instanceName: string;
  apiKey: string;
  numero: string;
  ativo: boolean;
};

const FORM_VAZIO: ConfigForm = {
  instanceUrl: "",
  instanceName: "",
  apiKey: "",
  numero: "",
  ativo: false,
};

export function AtendimentoCanalWhatsAppSection() {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existe, setExiste] = useState(false);
  const [form, setForm] = useState<ConfigForm>(FORM_VAZIO);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_atendimento_canal_config")
      .select("config,ativo")
      .eq("tenant_id", tenantId)
      .eq("canal", "whatsapp")
      .maybeSingle();
    if (data) {
      setExiste(true);
      const cfg = data.config as Record<string, unknown>;
      setForm({
        instanceUrl: (cfg.instance_url as string) ?? "",
        instanceName: (cfg.instance_name as string) ?? "",
        apiKey: (cfg.api_key as string) ?? "",
        numero: (cfg.numero as string) ?? "",
        ativo: data.ativo,
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
      canal: "whatsapp",
      ativo: form.ativo,
      config: {
        instance_url: form.instanceUrl || null,
        instance_name: form.instanceName || null,
        api_key: form.apiKey || null,
        numero: form.numero || null,
      },
    };
    const { error } = existe
      ? await supabase
          .from("tenant_atendimento_canal_config")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("canal", "whatsapp")
      : await supabase.from("tenant_atendimento_canal_config").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    setExiste(true);
    load();
  }

  if (loading) return null;

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/evolution?tenant_id=${tenantId}`
      : "";

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Canal de WhatsApp</h2>
          {existe &&
            (form.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Conecte a própria instância do Evolution API da sua imobiliária — a imoB365 nunca hospeda
          ou opera um número de WhatsApp em nome do tenant.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              URL da instância Evolution API
            </Label>
            <Input
              placeholder="https://evolution.suaempresa.com.br"
              value={form.instanceUrl}
              onChange={(e) => setForm((f) => ({ ...f, instanceUrl: e.target.value }))}
              autoComplete="off"
              name="atendimento-canal-whatsapp-url"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Nome da instância
            </Label>
            <Input
              value={form.instanceName}
              onChange={(e) => setForm((f) => ({ ...f, instanceName: e.target.value }))}
              autoComplete="off"
              name="atendimento-canal-whatsapp-instancia"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              autoComplete="new-password"
              name="atendimento-canal-whatsapp-apikey"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Número (com DDI, ex.: 5513999999999)
            </Label>
            <Input
              value={form.numero}
              onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              autoComplete="off"
              name="atendimento-canal-whatsapp-numero"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
          <Label htmlFor="canal-whatsapp-ativo" className="text-sm">
            Canal ativo
          </Label>
          <Switch
            id="canal-whatsapp-ativo"
            checked={form.ativo}
            onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-2 text-sm font-semibold">URL do webhook</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Cadastre esta URL como webhook de mensagens (evento <code>MESSAGES_UPSERT</code>) no
          painel da sua instância Evolution API.
        </p>
        <code className="block break-all rounded-md bg-muted p-3 text-[11px]">{webhookUrl}</code>
      </section>
    </div>
  );
}
