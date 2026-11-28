import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getTenantSmtpConfig,
  salvarTenantSmtpConfig,
  testarTenantSmtp,
  type TenantSmtpConfigLeitura,
} from "@/lib/tenantSmtp.functions";

export const Route = createFileRoute("/app/configuracoes/integracoes/email")({
  component: EmailIntegracaoPage,
});

type Form = {
  smtpHost: string;
  smtpPort: "465" | "587";
  seguranca: "ssl" | "starttls";
  usuario: string;
  senha: string; // vazio = manter a senha já salva
  nomeRemetente: string;
  emailRemetente: string;
  responderPara: string;
  ativo: boolean;
};

const FORM_VAZIO: Form = {
  smtpHost: "",
  smtpPort: "587",
  seguranca: "starttls",
  usuario: "",
  senha: "",
  nomeRemetente: "",
  emailRemetente: "",
  responderPara: "",
  ativo: false,
};

const MASCARA_SENHA = "••••••••";

const campoLabel = "mb-1.5 block text-xs uppercase text-muted-foreground";
const selectClasse =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function EmailIntegracaoPage() {
  const { tenantId } = useAuth();
  const getConfig = useServerFn(getTenantSmtpConfig);
  const salvar = useServerFn(salvarTenantSmtpConfig);
  const testar = useServerFn(testarTenantSmtp);

  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [senhaSalva, setSenhaSalva] = useState(false);
  const [ativoSalvo, setAtivoSalvo] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [destinoTeste, setDestinoTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<
    { ok: true } | { ok: false; motivo: string } | null
  >(null);

  function aplicar(c: TenantSmtpConfigLeitura) {
    setConfigurado(c.configurado);
    setSenhaSalva(c.senhaSalva);
    setAtivoSalvo(c.ativo);
    setForm({
      smtpHost: c.smtpHost,
      smtpPort: String(c.smtpPort) as "465" | "587",
      seguranca: c.seguranca,
      usuario: c.usuario,
      senha: "",
      nomeRemetente: c.nomeRemetente,
      emailRemetente: c.emailRemetente,
      responderPara: c.responderPara,
      ativo: c.ativo,
    });
  }

  async function carregar() {
    setLoading(true);
    setErroCarga(null);
    try {
      aplicar(await getConfig());
    } catch (err) {
      setErroCarga(err instanceof Error ? err.message : "Falha ao carregar a configuração");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tenantId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await salvar({
        data: {
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort) as 465 | 587,
          seguranca: form.seguranca,
          usuario: form.usuario,
          senha: form.senha || undefined,
          nomeRemetente: form.nomeRemetente,
          emailRemetente: form.emailRemetente,
          responderPara: form.responderPara,
          ativo: form.ativo,
        },
      });
      toast.success("Configuração de e-mail salva");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function enviarTeste() {
    setTesting(true);
    setResultadoTeste(null);
    try {
      const r = await testar({ data: { destinatario: destinoTeste } });
      setResultadoTeste(r.ok ? { ok: true } : { ok: false, motivo: r.motivo });
      if (r.ok) toast.success("E-mail de teste enviado");
      else toast.error(r.motivo);
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "Falha ao enviar o teste";
      setResultadoTeste({ ok: false, motivo });
      toast.error(motivo);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (erroCarga) {
    return (
      <div className="max-w-2xl space-y-4">
        <Header />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
          {erroCarga}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Header />

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-6"
        autoComplete="off"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Servidor de envio (SMTP)</h2>
          {configurado &&
            (ativoSalvo ? (
              <span className="text-xs font-medium text-primary">Ativo</span>
            ) : (
              <span className="text-xs text-muted-foreground">Inativo</span>
            ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="smtp-host" className={campoLabel}>
              Servidor SMTP
            </Label>
            <Input
              id="smtp-host"
              placeholder="smtp.seuprovedor.com.br"
              value={form.smtpHost}
              onChange={(e) => set("smtpHost", e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div>
            <Label htmlFor="smtp-porta" className={campoLabel}>
              Porta
            </Label>
            <select
              id="smtp-porta"
              className={selectClasse}
              value={form.smtpPort}
              onChange={(e) => set("smtpPort", e.target.value as "465" | "587")}
            >
              <option value="465">465</option>
              <option value="587">587</option>
            </select>
          </div>
          <div>
            <Label htmlFor="smtp-seguranca" className={campoLabel}>
              Segurança
            </Label>
            <select
              id="smtp-seguranca"
              className={selectClasse}
              value={form.seguranca}
              onChange={(e) => set("seguranca", e.target.value as "ssl" | "starttls")}
            >
              <option value="ssl">SSL/TLS</option>
              <option value="starttls">STARTTLS</option>
            </select>
          </div>
          <div>
            <Label htmlFor="smtp-usuario" className={campoLabel}>
              Usuário
            </Label>
            <Input
              id="smtp-usuario"
              value={form.usuario}
              onChange={(e) => set("usuario", e.target.value)}
              maxLength={255}
              autoComplete="off"
              name="smtp-usuario-tenant"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="smtp-senha" className={campoLabel}>
              Senha
            </Label>
            <Input
              id="smtp-senha"
              type="password"
              value={form.senha}
              onChange={(e) => set("senha", e.target.value)}
              placeholder={senhaSalva ? MASCARA_SENHA : ""}
              maxLength={512}
              autoComplete="new-password"
              name="smtp-senha-tenant"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {senhaSalva
                ? "Senha salva. Deixe em branco para mantê-la; preencha para trocar."
                : "Nenhuma senha salva ainda."}
            </p>
          </div>
        </div>

        <h2 className="pt-2 text-base font-semibold">Remetente</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="remetente-nome" className={campoLabel}>
              Nome do remetente
            </Label>
            <Input
              id="remetente-nome"
              placeholder="Imobiliária Exemplo"
              value={form.nomeRemetente}
              onChange={(e) => set("nomeRemetente", e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div>
            <Label htmlFor="remetente-email" className={campoLabel}>
              E-mail do remetente
            </Label>
            <Input
              id="remetente-email"
              type="email"
              placeholder="contato@exemplo.com.br"
              value={form.emailRemetente}
              onChange={(e) => set("emailRemetente", e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="responder-para" className={campoLabel}>
              Responder para (opcional)
            </Label>
            <Input
              id="responder-para"
              type="email"
              placeholder="atendimento@exemplo.com.br"
              value={form.responderPara}
              onChange={(e) => set("responderPara", e.target.value)}
              maxLength={255}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
          <Label htmlFor="email-ativo" className="text-sm">
            Ativo
          </Label>
          <Switch id="email-ativo" checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Testar envio</h2>
        <p className="text-xs text-muted-foreground">
          Envia um e-mail de teste usando a configuração salva. Limite de 1 teste a cada 60
          segundos.
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            type="email"
            placeholder="seu-email@exemplo.com"
            value={destinoTeste}
            onChange={(e) => setDestinoTeste(e.target.value)}
            maxLength={255}
            aria-label="Endereço para o e-mail de teste"
          />
          <Button
            type="button"
            variant="outline"
            onClick={enviarTeste}
            disabled={testing || !destinoTeste.trim() || !senhaSalva}
          >
            {testing ? "Enviando…" : "Enviar e-mail de teste"}
          </Button>
        </div>
        {!senhaSalva && (
          <p className="text-xs text-muted-foreground">Salve a configuração antes de testar.</p>
        )}
        {resultadoTeste?.ok && (
          <p className="text-sm text-primary">
            Teste enviado com sucesso. Confira sua caixa de entrada.
          </p>
        )}
        {resultadoTeste && !resultadoTeste.ok && (
          <p className="text-sm text-destructive">Falha no teste: {resultadoTeste.motivo}</p>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <Mail className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-semibold">E-mail (SMTP)</h2>
    </div>
  );
}
