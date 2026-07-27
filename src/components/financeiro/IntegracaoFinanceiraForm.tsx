import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export type IntegracaoFinanceira = {
  id: string;
  tipo: "conciliacao_bancaria" | "erp";
  provider: string;
  nome_exibicao: string;
  config: Record<string, string>;
  ativo: boolean;
};

const PROVIDERS_BANCO = [
  { value: "bb", label: "Banco do Brasil" },
  { value: "itau", label: "Itaú" },
  { value: "bradesco", label: "Bradesco" },
  { value: "santander", label: "Santander" },
  { value: "nubank", label: "Nubank" },
  { value: "caixa", label: "Caixa" },
  { value: "outro", label: "Outro" },
];
const PROVIDERS_ERP = [
  { value: "conta_azul", label: "Conta Azul" },
  { value: "omie", label: "Omie" },
  { value: "outro", label: "Outro" },
];

// Cadastro/config de integrações bancárias (conciliação) e ERPs — Fase 4 do
// módulo Financeiro. Pedido explícito do usuário: fornecer o modelo e a
// infra administrativa pra essa conexão, sem que nenhuma chamada real à
// API externa aconteça ainda — por isso é escrita direta do client (RLS
// admin), mesmo padrão de plano_contas/centros_custo, sem server function.
export function IntegracaoFinanceiraForm({
  existing,
  onSaved,
}: {
  existing?: IntegracaoFinanceira;
  onSaved: () => void;
}) {
  const { tenantId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"conciliacao_bancaria" | "erp">(
    existing?.tipo ?? "conciliacao_bancaria",
  );
  const [provider, setProvider] = useState(existing?.provider ?? PROVIDERS_BANCO[0].value);
  const [nome, setNome] = useState(existing?.nome_exibicao ?? "");
  const [ativo, setAtivo] = useState(existing?.ativo ?? false);
  const [agencia, setAgencia] = useState(existing?.config?.agencia ?? "");
  const [conta, setConta] = useState(existing?.config?.conta ?? "");
  const [clientId, setClientId] = useState(existing?.config?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState(existing?.config?.client_secret ?? "");
  const [saving, setSaving] = useState(false);

  const providers = tipo === "erp" ? PROVIDERS_ERP : PROVIDERS_BANCO;

  useEffect(() => {
    if (!providers.some((p) => p.value === provider)) {
      setProvider(providers[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  // Reseta/resincroniza os campos toda vez que o modal abre — sem isso, o
  // botão "Adicionar integração" (mesma instância reaproveitada a cada
  // clique) ficava mostrando os dados da última tentativa em vez de um
  // formulário limpo.
  useEffect(() => {
    if (!open) return;
    setTipo(existing?.tipo ?? "conciliacao_bancaria");
    setProvider(existing?.provider ?? PROVIDERS_BANCO[0].value);
    setNome(existing?.nome_exibicao ?? "");
    setAtivo(existing?.ativo ?? false);
    setAgencia(existing?.config?.agencia ?? "");
    setConta(existing?.config?.conta ?? "");
    setClientId(existing?.config?.client_id ?? "");
    setClientSecret(existing?.config?.client_secret ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    if (!nome.trim()) return toast.error("Informe um nome de exibição");
    setSaving(true);

    const config =
      tipo === "erp" ? { client_id: clientId, client_secret: clientSecret } : { agencia, conta };
    const payload = {
      tenant_id: tenantId,
      tipo,
      provider,
      nome_exibicao: nome.trim(),
      config,
      ativo,
    };

    const { error } = existing
      ? await (supabase as any)
          .from("tenant_integracoes_financeiras")
          .update(payload)
          .eq("id", existing.id)
      : await (supabase as any)
          .from("tenant_integracoes_financeiras")
          .insert({ ...payload, created_by: user?.id });

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Integração atualizada" : "Integração adicionada");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm">
            Editar
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Adicionar integração
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Editar integração" : "Nova integração bancária/ERP"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Tipo</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "conciliacao_bancaria" | "erp")}
            >
              <option value="conciliacao_bancaria">Conciliação bancária</option>
              <option value="erp">ERP</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              {tipo === "erp" ? "ERP" : "Banco"}
            </Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Nome de exibição
            </Label>
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Conta corrente principal"
              maxLength={120}
            />
          </div>

          {tipo === "conciliacao_bancaria" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                  Agência
                </Label>
                <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                  Conta
                </Label>
                <Input value={conta} onChange={(e) => setConta(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                  Client ID
                </Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                  Client Secret
                </Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
            <Label htmlFor="integracao-ativa" className="text-sm">
              Ativa
            </Label>
            <Switch id="integracao-ativa" checked={ativo} onCheckedChange={setAtivo} />
          </div>

          <p className="text-xs text-muted-foreground">
            Este cadastro só guarda os dados de conexão — nenhuma sincronização real com o banco/ERP
            é feita ainda.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
