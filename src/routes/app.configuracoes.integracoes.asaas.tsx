import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plug, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { actionGuard } from "@/lib/routeGuard";
import {
  obterConfigAsaas,
  salvarConfigAsaas,
  salvarAsaasInput,
  testarConexaoAsaas,
  type AsaasConfigView,
  type TesteConexaoAsaas,
} from "@/lib/asaas.functions";
import type { AsaasAmbiente } from "@/integrations/asaas/client.server";

export const Route = createFileRoute("/app/configuracoes/integracoes/asaas")({
  beforeLoad: actionGuard("ajustes", "config"),
  head: () => ({ meta: [{ title: "Asaas — imob365" }] }),
  component: AsaasSettingsPage,
});

type FormState = {
  ambiente: AsaasAmbiente;
  apiKey: string;
  nomeExibicao: string;
  contaRecebimento: string;
  multa: string;
  juros: string;
  desconto: string;
  tolerancia: string;
  ativo: boolean;
};

const FORM_PADRAO: FormState = {
  ambiente: "sandbox",
  apiKey: "",
  nomeExibicao: "Asaas",
  contaRecebimento: "",
  multa: "2",
  juros: "1",
  desconto: "0",
  tolerancia: "0",
  ativo: false,
};

function paraFormulario(view: AsaasConfigView): FormState {
  return {
    ambiente: view.ambiente,
    apiKey: "",
    nomeExibicao: view.nomeExibicao,
    contaRecebimento: view.contaRecebimento,
    multa: String(view.multaPercentual),
    juros: String(view.jurosMensalPercentual),
    desconto: String(view.descontoAntecipadoPercentual),
    tolerancia: String(view.diasTolerancia),
    ativo: view.ativo,
  };
}

// Converte o texto do input em número; campo vazio vira NaN e o Zod rejeita.
const numero = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(",", ".")));

function AsaasSettingsPage() {
  const { roles } = useAuth();
  const podeGerenciar = can(roles, "ajustes", "config");

  const fetchConfig = useServerFn(obterConfigAsaas);
  const salvarFn = useServerFn(salvarConfigAsaas);
  const testarFn = useServerFn(testarConexaoAsaas);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["asaas-config"],
    queryFn: () => fetchConfig(),
    enabled: podeGerenciar,
  });

  const [form, setForm] = useState<FormState>(FORM_PADRAO);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [teste, setTeste] = useState<TesteConexaoAsaas | null>(null);

  useEffect(() => {
    if (data) setForm(paraFormulario(data));
  }, [data]);

  if (!podeGerenciar) {
    return <div className="p-8 text-sm text-muted-foreground">Apenas administradores.</div>;
  }

  const temChaveSalva = !!data?.apiKeyMascarada;
  const trocandoChave = form.apiKey.trim().length > 0;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const parsed = salvarAsaasInput.safeParse({
      ambiente: form.ambiente,
      apiKey: form.apiKey.trim(),
      nomeExibicao: form.nomeExibicao,
      contaRecebimento: form.contaRecebimento,
      multaPercentual: numero(form.multa),
      jurosMensalPercentual: numero(form.juros),
      descontoAntecipadoPercentual: numero(form.desconto),
      diasTolerancia: numero(form.tolerancia),
      ativo: form.ativo,
    });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
    }
    setSaving(true);
    try {
      await salvarFn({ data: parsed.data });
      toast.success("Configuração do Asaas salva");
      setTeste(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar a configuração");
    } finally {
      setSaving(false);
    }
  }

  async function testar() {
    setTesting(true);
    setTeste(null);
    try {
      const resultado = await testarFn();
      setTeste(resultado);
    } catch (err: any) {
      setTeste({ conectado: false, mensagem: err?.message ?? "Falha ao testar a conexão" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="p-8">
      <Link
        to="/app/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Asaas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte a conta Asaas da imobiliária para gerar boletos de aluguel. A chave de API fica
          protegida no servidor e nunca é exibida novamente.
        </p>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <form onSubmit={salvar} className="max-w-2xl space-y-6">
          <section className="space-y-5 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Conexão</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="asaas-ambiente">Ambiente</Label>
                <Select
                  value={form.ambiente}
                  onValueChange={(v) => set("ambiente", v as AsaasAmbiente)}
                >
                  <SelectTrigger id="asaas-ambiente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use a chave do mesmo ambiente. Chaves de sandbox não funcionam em produção.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asaas-nome">Nome de exibição</Label>
                <Input
                  id="asaas-nome"
                  value={form.nomeExibicao}
                  maxLength={80}
                  onChange={(e) => set("nomeExibicao", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asaas-chave">Chave de API</Label>
              <Input
                id="asaas-chave"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                placeholder={temChaveSalva ? (data?.apiKeyMascarada ?? "") : "Cole a chave de API"}
                value={form.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {temChaveSalva
                  ? `Chave salva: ${data?.apiKeyMascarada}. Deixe em branco para mantê-la; digite uma nova para substituí-la.`
                  : "Nenhuma chave salva ainda. Obrigatória para ativar a integração."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asaas-conta">Conta de recebimento</Label>
              <Input
                id="asaas-conta"
                value={form.contaRecebimento}
                maxLength={120}
                placeholder="Ex.: Banco 341 · Ag 0001 · CC 12345-6"
                onChange={(e) => set("contaRecebimento", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Apenas informativo, para referência interna. Não altera o recebimento no Asaas.
              </p>
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-border bg-card p-6">
            <div>
              <h2 className="text-base font-semibold">Regras de cobrança padrão</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aplicadas aos boletos de aluguel gerados por esta integração.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="asaas-multa">Multa (%)</Label>
                <Input
                  id="asaas-multa"
                  inputMode="decimal"
                  value={form.multa}
                  onChange={(e) => set("multa", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asaas-juros">Juros ao mês (%)</Label>
                <Input
                  id="asaas-juros"
                  inputMode="decimal"
                  value={form.juros}
                  onChange={(e) => set("juros", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asaas-desconto">Desconto para pagamento antecipado (%)</Label>
                <Input
                  id="asaas-desconto"
                  inputMode="decimal"
                  value={form.desconto}
                  onChange={(e) => set("desconto", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asaas-tolerancia">Dias de tolerância após o vencimento</Label>
                <Input
                  id="asaas-tolerancia"
                  inputMode="numeric"
                  value={form.tolerancia}
                  onChange={(e) => set("tolerancia", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
              <div>
                <Label htmlFor="asaas-ativo" className="text-sm">
                  Integração ativa
                </Label>
                <p className="text-xs text-muted-foreground">
                  Só é possível ativar com uma chave de API salva.
                </p>
              </div>
              <Switch
                id="asaas-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => set("ativo", v)}
              />
            </div>
          </section>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar configuração"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={testar}
                disabled={testing || !temChaveSalva || trocandoChave}
              >
                <Plug className="mr-2 h-4 w-4" />
                {testing ? "Testando…" : "Testar conexão"}
              </Button>
            </div>
            {trocandoChave && (
              <p className="text-xs text-muted-foreground">
                Salve a nova chave antes de testar a conexão.
              </p>
            )}

            {teste && (
              <div
                role="status"
                className={
                  teste.conectado
                    ? "flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
                    : "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
                }
              >
                {teste.conectado ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>{teste.conectado ? "Conectado" : teste.mensagem}</span>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
