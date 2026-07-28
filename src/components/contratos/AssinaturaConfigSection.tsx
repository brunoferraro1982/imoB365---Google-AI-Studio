import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PROVIDERS = [
  { value: "docusign", label: "DocuSign" },
  { value: "clicksign", label: "Clicksign" },
  { value: "zapsign", label: "ZapSign" },
  { value: "gov_br", label: "gov.br" },
  { value: "icp_brasil", label: "ICP-Brasil" },
  { value: "outro", label: "Outro" },
];

// BYO por tenant (nunca conta mestre da imoB365) — mesmo trade-off já aceito
// em tenant_integracoes_financeiras: sem infra de criptografia no projeto
// hoje, o segredo fica em texto plano protegido só por RLS admin-only.
export function AssinaturaConfigSection() {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existe, setExiste] = useState(false);
  const [form, setForm] = useState({
    provider: "clicksign",
    apiKey: "",
    webhookSecret: "",
    ativo: false,
  });

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("tenant_assinatura_config")
      .select("provider,api_key,webhook_secret,ativo")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) {
      setExiste(true);
      setForm({
        provider: data.provider,
        apiKey: data.api_key ?? "",
        webhookSecret: data.webhook_secret ?? "",
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
      provider: form.provider,
      api_key: form.apiKey || null,
      webhook_secret: form.webhookSecret || null,
      ativo: form.ativo,
    };
    const { error } = existe
      ? await (supabase as any)
          .from("tenant_assinatura_config")
          .update(payload)
          .eq("tenant_id", tenantId)
      : await (supabase as any).from("tenant_assinatura_config").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    setExiste(true);
    load();
  }

  if (loading) return null;

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/assinatura/${form.provider}?tenant_id=${tenantId}`
      : "";

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Provedor de assinatura eletrônica</h2>
          {existe &&
            (form.ativo ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Conecte a conta que sua imobiliária já tem em um provedor de assinatura eletrônica.
          Nenhuma credencial da imoB365 é compartilhada — cada tenant usa a própria conta.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Provedor</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              API Key / Token
            </Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              maxLength={300}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Segredo do webhook (HMAC)
            </Label>
            <Input
              type="password"
              value={form.webhookSecret}
              onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
              maxLength={300}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
          <Label htmlFor="assinatura-ativa" className="text-sm">
            Integração ativa
          </Label>
          <Switch
            id="assinatura-ativa"
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
          Cadastre esta URL no painel do provedor escolhido, para os eventos de assinatura de
          envelope/documento. O corpo da notificação deve ser{" "}
          <code>{'{ referencia_externa, status: "enviado"|"assinado" }'}</code>, assinado em
          HMAC-SHA256 (hex) no header <code>x-assinatura-signature</code>, usando o segredo acima.
        </p>
        <code className="block break-all rounded-md bg-muted p-3 text-[11px]">{webhookUrl}</code>
      </section>
    </div>
  );
}
