import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getNfeConfigStatus, salvarNfeConfig, removerNfeConfig } from "@/lib/nfeFocusNfe.functions";

// BYO de verdade (API key, não OAuth — confirmado que nenhum provedor de
// NFe/NFSe oferece fluxo de redirecionamento) — cada tenant cria a própria
// conta no Focus NFe, registra o próprio CNPJ e certificado digital
// diretamente no painel deles, e cola aqui só o token. Nenhuma credencial
// da imoB365 é compartilhada, nenhum certificado digital é custodiado por
// aqui — decisão deliberada, consistente com o princípio de autonomia do
// tenant já usado em todas as outras integrações deste projeto.
export function NotaFiscalConfigSection() {
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({
    token: "",
    ambiente: "homologacao" as "homologacao" | "producao",
    cnpjPrestador: "",
    inscricaoMunicipal: "",
    codigoMunicipioIbge: "",
    itemListaServico: "10.05",
    optanteSimplesNacional: true,
    ativo: false,
  });

  const fetchStatus = useServerFn(getNfeConfigStatus);
  const salvar = useServerFn(salvarNfeConfig);
  const remover = useServerFn(removerNfeConfig);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nfe-config-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ambiente: data.ambiente, ativo: data.ativo }));
  }, [data]);

  async function onSalvar(e: FormEvent) {
    e.preventDefault();
    if (
      !form.token ||
      !form.cnpjPrestador ||
      !form.inscricaoMunicipal ||
      !form.codigoMunicipioIbge
    ) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await salvar({ data: { ...form, cnpjPrestador: form.cnpjPrestador.replace(/\D/g, "") } });
      toast.success("Configuração de Nota Fiscal salva.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onRemover() {
    if (!confirm("Isso apaga toda a configuração de Nota Fiscal. Tem certeza?")) return;
    setRemoving(true);
    try {
      await remover();
      toast.success("Configuração removida.");
      setForm({
        token: "",
        ambiente: "homologacao",
        cnpjPrestador: "",
        inscricaoMunicipal: "",
        codigoMunicipioIbge: "",
        itemListaServico: "10.05",
        optanteSimplesNacional: true,
        ativo: false,
      });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover");
    } finally {
      setRemoving(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 text-sm">
        <p className="mb-2 font-medium">Passo a passo</p>
        <ol className="space-y-2.5 text-xs text-muted-foreground">
          <li>
            <strong>1.</strong> Crie sua conta em{" "}
            <a
              href="https://focusnfe.com.br"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              focusnfe.com.br <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            (tem teste grátis de 30 dias) e registre seu CNPJ e certificado digital (e-CNPJ)
            diretamente no painel deles — o imob365 não guarda nem tem acesso ao seu certificado.
          </li>
          <li>
            <strong>2.</strong> Copie o <strong>Token de acesso</strong> no painel deles
            (Integrações → API).
          </li>
          <li>
            <strong>3.</strong> Preencha os dados abaixo e comece testando em{" "}
            <strong>Homologação</strong> — só mude pra Produção depois de confirmar que uma nota de
            teste saiu certo.
          </li>
        </ol>
      </div>

      <form onSubmit={onSalvar} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Focus NFe</h2>
          {data?.configured && (
            <Badge className="gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Configurado
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Token de acesso</Label>
            <Input
              type="password"
              value={form.token}
              onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              placeholder={data?.configured ? "•••••••••••••••• (já salvo)" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ do prestador</Label>
            <Input
              value={form.cnpjPrestador}
              onChange={(e) => setForm((f) => ({ ...f, cnpjPrestador: e.target.value }))}
              placeholder="Só números"
              maxLength={18}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição municipal</Label>
            <Input
              value={form.inscricaoMunicipal}
              onChange={(e) => setForm((f) => ({ ...f, inscricaoMunicipal: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código IBGE do município</Label>
            <Input
              value={form.codigoMunicipioIbge}
              onChange={(e) => setForm((f) => ({ ...f, codigoMunicipioIbge: e.target.value }))}
              placeholder="7 dígitos"
              maxLength={7}
            />
            <a
              href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline"
            >
              Consultar código do meu município <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-1.5">
            <Label>Item da lista de serviço (LC 116/2003)</Label>
            <Input
              value={form.itemListaServico}
              onChange={(e) => setForm((f) => ({ ...f, itemListaServico: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              10.05 é o item padrão pra corretagem/intermediação imobiliária.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
            <Label className="text-sm">
              Ambiente de produção (nota fiscal real, com valor legal)
            </Label>
            <Switch
              checked={form.ambiente === "producao"}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, ambiente: v ? "producao" : "homologacao" }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
            <Label className="text-sm">Optante pelo Simples Nacional</Label>
            <Switch
              checked={form.optanteSimplesNacional}
              onCheckedChange={(v) => setForm((f) => ({ ...f, optanteSimplesNacional: v }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
            <Label className="text-sm">Integração ativa</Label>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
            />
          </div>
        </div>

        {form.ambiente === "producao" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Em produção, toda nota emitida tem valor fiscal real e é comunicada à prefeitura — não
              use pra testes.
            </span>
          </div>
        )}

        <div className="flex justify-between gap-2">
          {data?.configured && (
            <Button
              type="button"
              variant="ghost"
              onClick={onRemover}
              disabled={removing}
              className="text-red-600"
            >
              {removing ? "Removendo…" : "Remover configuração"}
            </Button>
          )}
          <Button type="submit" disabled={saving} className="ml-auto">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        Precisa de ajuda?{" "}
        <Link to="/ajuda/nota-fiscal" target="_blank" className="text-primary underline">
          Ver guia completo, passo a passo
        </Link>
        .
      </p>
    </div>
  );
}
