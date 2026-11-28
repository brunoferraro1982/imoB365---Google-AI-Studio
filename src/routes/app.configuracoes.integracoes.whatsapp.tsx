import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  obterWhatsAppEvolution,
  salvarWhatsAppEvolution,
  testarWhatsAppEvolution,
} from "@/lib/whatsappEvolution.functions";

export const Route = createFileRoute("/app/configuracoes/integracoes/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp (Evolution API) — imob365" }] }),
  component: WhatsAppEvolutionPage,
});

type FormState = {
  instanceUrl: string;
  instanceName: string;
  apiKey: string;
  ativo: boolean;
  mensagemBoasVindas: string;
};

type TesteEstado = { estado: "conectado" | "desconectado" | "erro"; mensagem: string } | null;

function WhatsAppEvolutionPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="p-8">
      <Link
        to="/app/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <MessageCircle className="h-7 w-7" /> WhatsApp (Evolution API)
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Conecte a instância da Evolution API da sua imobiliária. Cada tenant usa a própria
          instância e as próprias credenciais — a imoB365 não opera um número de WhatsApp em nome do
          cliente.
        </p>
      </header>

      {isAdmin ? (
        <WhatsAppEvolutionSection />
      ) : (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem configurar o WhatsApp.
        </p>
      )}
    </div>
  );
}

const FORM_VAZIO: FormState = {
  instanceUrl: "",
  instanceName: "",
  apiKey: "",
  ativo: false,
  mensagemBoasVindas: "",
};

function WhatsAppEvolutionSection() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(obterWhatsAppEvolution);
  const salvar = useServerFn(salvarWhatsAppEvolution);
  const testar = useServerFn(testarWhatsAppEvolution);

  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<TesteEstado>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-evolution-config"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      instanceUrl: data.instanceUrl,
      instanceName: data.instanceName,
      apiKey: "",
      ativo: data.ativo,
      mensagemBoasVindas: data.mensagemBoasVindas,
    });
  }, [data]);

  async function onSalvar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await salvar({
        data: {
          instanceUrl: form.instanceUrl,
          instanceName: form.instanceName,
          apiKey: form.apiKey,
          ativo: form.ativo,
          mensagemBoasVindas: form.mensagemBoasVindas,
        },
      });
      toast.success("Configuração do WhatsApp salva");
      setForm((f) => ({ ...f, apiKey: "" }));
      setTeste(null);
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-evolution-config"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onTestar() {
    setTestando(true);
    setTeste(null);
    try {
      const resultado = await testar();
      setTeste({ estado: resultado.estado, mensagem: resultado.mensagem });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-evolution-config"] });
    } catch (err) {
      setTeste({
        estado: "erro",
        mensagem: err instanceof Error ? err.message : "Falha ao testar a conexão",
      });
    } finally {
      setTestando(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={onSalvar} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Conexão</h2>
          {data?.configurado ? (
            form.ativo ? (
              <Badge>Ativo</Badge>
            ) : (
              <Badge variant="secondary">Inativo</Badge>
            )
          ) : (
            <Badge variant="outline">Não configurado</Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              URL base da Evolution API
            </Label>
            <Input
              placeholder="https://evolution.suaempresa.com.br"
              value={form.instanceUrl}
              onChange={(e) => setForm((f) => ({ ...f, instanceUrl: e.target.value }))}
              autoComplete="off"
              name="whatsapp-evolution-url"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Somente https://</p>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Nome da instância
            </Label>
            <Input
              value={form.instanceName}
              onChange={(e) => setForm((f) => ({ ...f, instanceName: e.target.value }))}
              autoComplete="off"
              name="whatsapp-evolution-instancia"
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Chave de API
            </Label>
            <Input
              type="password"
              placeholder={data?.apiKeyMascarada ?? "Cole a chave da instância"}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              autoComplete="new-password"
              name="whatsapp-evolution-apikey"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.apiKeyMascarada
                ? `Chave salva (${data.apiKeyMascarada}). Deixe em branco para mantê-la.`
                : "A chave fica guardada no servidor e nunca é exibida novamente."}
            </p>
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Número conectado
            </Label>
            <Input
              value={data?.numeroConectado ?? ""}
              readOnly
              disabled
              placeholder="Disponível após o teste de conexão"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Mensagem padrão de boas-vindas (opcional)
            </Label>
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.mensagemBoasVindas}
              onChange={(e) => setForm((f) => ({ ...f, mensagemBoasVindas: e.target.value }))}
              placeholder="Olá! Recebemos sua mensagem e em breve um corretor responderá."
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
          <Label htmlFor="whatsapp-evolution-ativo" className="text-sm">
            Integração ativa
          </Label>
          <Switch
            id="whatsapp-evolution-ativo"
            checked={form.ativo}
            onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onTestar} disabled={testando}>
            <PlugZap className="mr-2 h-4 w-4" />
            {testando ? "Testando…" : "Testar conexão"}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>

        {teste && (
          <div
            role="status"
            className={
              teste.estado === "conectado"
                ? "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm"
                : teste.estado === "desconectado"
                  ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                  : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
            }
          >
            <strong className="mr-1">
              {teste.estado === "conectado"
                ? "Conectado:"
                : teste.estado === "desconectado"
                  ? "Desconectado:"
                  : "Erro:"}
            </strong>
            {teste.mensagem}
          </div>
        )}
      </form>

      <p className="text-xs text-muted-foreground">
        O teste usa a configuração salva. Salve as alterações antes de testar.
      </p>
    </div>
  );
}
