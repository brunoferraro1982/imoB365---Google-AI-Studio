import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// BYO por tenant (nunca uma caixa de e-mail compartilhada da imoB365) —
// mesmo trade-off já aceito em tenant_assinatura_config: sem infra de
// criptografia no projeto hoje, a senha fica em texto plano protegida só
// por RLS admin-only. A própria imoB365 (Tenant 0) configura o próprio
// balcão por aqui também, sem caso especial — ver memória
// "imob365-tenant-autonomy-byo-credentials".
type ConfigForm = {
  smtpHost: string;
  smtpPort: string;
  imapHost: string;
  imapPort: string;
  usuario: string;
  senha: string;
  enderecoExibicao: string;
  ativo: boolean;
};

const FORM_VAZIO: ConfigForm = {
  smtpHost: "",
  smtpPort: "587",
  imapHost: "",
  imapPort: "993",
  usuario: "",
  senha: "",
  enderecoExibicao: "",
  ativo: false,
};

export function AtendimentoCanalEmailSection() {
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
      .eq("canal", "email")
      .maybeSingle();
    if (data) {
      setExiste(true);
      const cfg = data.config as Record<string, unknown>;
      setForm({
        smtpHost: (cfg.smtp_host as string) ?? "",
        smtpPort: String(cfg.smtp_port ?? 587),
        imapHost: (cfg.imap_host as string) ?? "",
        imapPort: String(cfg.imap_port ?? 993),
        usuario: (cfg.usuario as string) ?? "",
        senha: (cfg.senha as string) ?? "",
        enderecoExibicao: (cfg.endereco_exibicao as string) ?? "",
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
      canal: "email",
      ativo: form.ativo,
      config: {
        smtp_host: form.smtpHost || null,
        smtp_port: Number(form.smtpPort) || 587,
        imap_host: form.imapHost || null,
        imap_port: Number(form.imapPort) || 993,
        usuario: form.usuario || null,
        senha: form.senha || null,
        endereco_exibicao: form.enderecoExibicao || null,
      },
    };
    const { error } = existe
      ? await supabase
          .from("tenant_atendimento_canal_config")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("canal", "email")
      : await supabase.from("tenant_atendimento_canal_config").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    setExiste(true);
    load();
  }

  if (loading) return null;

  return (
    <form
      onSubmit={salvar}
      className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Canal de E-mail</h2>
        {existe && (form.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>)}
      </div>
      <p className="text-xs text-muted-foreground">
        Conecte a própria caixa de e-mail da sua imobiliária (SMTP para envio, IMAP para receber
        respostas) — a Central de Atendimento nunca usa uma caixa compartilhada da imoB365.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Servidor SMTP (envio)
          </Label>
          <Input
            placeholder="smtp.seuprovedor.com.br"
            value={form.smtpHost}
            onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Porta SMTP</Label>
          <Input
            value={form.smtpPort}
            onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Servidor IMAP (recebimento)
          </Label>
          <Input
            placeholder="imap.seuprovedor.com.br"
            value={form.imapHost}
            onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Porta IMAP</Label>
          <Input
            value={form.imapPort}
            onChange={(e) => setForm((f) => ({ ...f, imapPort: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Usuário / e-mail
          </Label>
          <Input
            value={form.usuario}
            onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
            autoComplete="off"
            name="atendimento-canal-email-usuario"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Senha</Label>
          <Input
            type="password"
            value={form.senha}
            onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            autoComplete="new-password"
            name="atendimento-canal-email-senha"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Nome de exibição no envio (opcional)
          </Label>
          <Input
            placeholder="Imobiliária Exemplo <atendimento@exemplo.com.br>"
            value={form.enderecoExibicao}
            onChange={(e) => setForm((f) => ({ ...f, enderecoExibicao: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
        <Label htmlFor="canal-email-ativo" className="text-sm">
          Canal ativo
        </Label>
        <Switch
          id="canal-email-ativo"
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
  );
}
