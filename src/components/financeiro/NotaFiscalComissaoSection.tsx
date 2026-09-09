import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Receipt, Settings, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import {
  getNfeConfigStatus,
  emitirNotaFiscal,
  consultarNotaFiscal,
  listarNotasFiscaisDaComissao,
} from "@/lib/nfeFocusNfe.functions";
import { formatBRL } from "@/lib/format";

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  processando_autorizacao: { label: "Processando", variant: "secondary" },
  autorizado: { label: "Autorizada", variant: "default" },
  erro_autorizacao: { label: "Erro", variant: "destructive" },
  cancelado: { label: "Cancelada", variant: "secondary" },
};

type Nota = {
  id: string;
  status: string;
  numero: string | null;
  url_danfse: string | null;
  valor_servicos: number;
  tomador_nome: string;
  erro_mensagem: string | null;
  created_at: string;
};

// Emissão real de NFS-e a partir de uma comissão — primeira integração
// fiscal deste projeto (BYO simplificado, Focus NFe). O tomador (quem
// recebe a nota) é informado manualmente, já que não há um campo único
// definindo "quem paga a comissão" no contrato — evita adivinhar errado.
export function NotaFiscalComissaoSection({ comissaoId }: { comissaoId: string }) {
  const { tenantId } = useAuth();
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [valorComissao, setValorComissao] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [consultando, setConsultando] = useState<string | null>(null);
  const [form, setForm] = useState({ tomadorNome: "", tomadorDocumento: "", tomadorEmail: "" });

  const fetchStatus = useServerFn(getNfeConfigStatus);
  const emitir = useServerFn(emitirNotaFiscal);
  const consultar = useServerFn(consultarNotaFiscal);
  const listar = useServerFn(listarNotasFiscaisDaComissao);

  async function load() {
    const [status, lista, comissao] = await Promise.all([
      fetchStatus(),
      listar({ data: { comissaoId } }),
      supabase.from("comissoes").select("valor").eq("id", comissaoId).maybeSingle(),
    ]);
    setConfigurado(status.configured && status.ativo);
    setNotas(lista as Nota[]);
    setValorComissao((comissao.data as any)?.valor ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comissaoId, tenantId]);

  async function onEmitir() {
    if (!form.tomadorNome.trim() || !form.tomadorDocumento.trim() || !valorComissao) {
      toast.error("Preencha nome e CPF/CNPJ do tomador.");
      return;
    }
    setEmitindo(true);
    try {
      await emitir({
        data: {
          comissaoId,
          valorServicos: valorComissao,
          discriminacao: `Comissão de corretagem/intermediação imobiliária referente ao contrato.`,
          tomadorNome: form.tomadorNome.trim(),
          tomadorDocumento: form.tomadorDocumento.replace(/\D/g, ""),
          tomadorEmail: form.tomadorEmail.trim() || undefined,
        },
      });
      toast.success("Nota fiscal enviada pro Focus NFe — processando autorização.");
      setShowForm(false);
      setForm({ tomadorNome: "", tomadorDocumento: "", tomadorEmail: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao emitir nota fiscal");
    } finally {
      setEmitindo(false);
    }
  }

  async function onConsultar(nfeId: string) {
    setConsultando(nfeId);
    try {
      await consultar({ data: { nfeId } });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar status");
    } finally {
      setConsultando(null);
    }
  }

  if (configurado === null) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold">
        <Receipt className="h-4 w-4" /> Nota Fiscal
      </h2>

      {!configurado ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p className="mb-2">Nenhuma conta de Nota Fiscal conectada para este tenant.</p>
          <Link
            to="/app/configuracoes/nota-fiscal"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Settings className="h-3.5 w-3.5" /> Configurar Nota Fiscal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {notas.length > 0 && (
            <ul className="space-y-2">
              {notas.map((n) => {
                const st = STATUS_LABEL[n.status] ?? {
                  label: n.status,
                  variant: "secondary" as const,
                };
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{n.tomador_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBRL(n.valor_servicos)}
                        {n.numero && ` · nº ${n.numero}`}
                        {n.erro_mensagem && ` · ${n.erro_mensagem}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {n.url_danfse ? (
                        <a href={n.url_danfse} target="_blank" rel="noreferrer">
                          <Button type="button" size="sm" variant="outline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={consultando === n.id}
                          onClick={() => onConsultar(n.id)}
                        >
                          {consultando === n.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {showForm ? (
            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do tomador (quem recebe a nota)</Label>
                <Input
                  value={form.tomadorNome}
                  onChange={(e) => setForm((f) => ({ ...f, tomadorNome: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">CPF ou CNPJ</Label>
                  <Input
                    value={form.tomadorDocumento}
                    onChange={(e) => setForm((f) => ({ ...f, tomadorDocumento: e.target.value }))}
                    placeholder="Só números"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail (opcional)</Label>
                  <Input
                    value={form.tomadorEmail}
                    onChange={(e) => setForm((f) => ({ ...f, tomadorEmail: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Valor da nota: {valorComissao != null ? formatBRL(valorComissao) : "—"} (valor da
                comissão)
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onEmitir} disabled={emitindo}>
                  {emitindo ? "Emitindo…" : "Emitir nota fiscal"}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" onClick={() => setShowForm(true)}>
              <Receipt className="mr-1 h-3.5 w-3.5" /> Emitir nota fiscal
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
