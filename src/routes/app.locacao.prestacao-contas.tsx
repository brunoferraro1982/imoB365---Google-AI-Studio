import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { moduleGuard } from "@/lib/routeGuard";
import { getPrestacaoContas, listImoveisComLocacaoAtiva } from "@/lib/prestacaoContas.functions";

export const Route = createFileRoute("/app/locacao/prestacao-contas")({
  beforeLoad: moduleGuard("financeiro"),
  head: () => ({ meta: [{ title: "Prestação de contas — imob365" }] }),
  component: PrestacaoContasPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  recebido: "Aluguel recebido",
  repassado: "Repassado",
};

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMesLabel(mesReferencia: string) {
  const [ano, mes] = mesReferencia.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function PrestacaoContasPage() {
  const listImoveis = useServerFn(listImoveisComLocacaoAtiva);
  const fetchPrestacao = useServerFn(getPrestacaoContas);

  const [imovelId, setImovelId] = useState<string>("");
  const [mesInput, setMesInput] = useState<string>(mesAtualISO());

  const {
    data: imoveis,
    isLoading: isLoadingImoveis,
    error: imoveisError,
  } = useQuery({
    queryKey: ["imoveis-locacao-ativa"],
    queryFn: () => listImoveis(),
  });

  useEffect(() => {
    if (!imovelId && imoveis && imoveis.length > 0) setImovelId(imoveis[0].id);
  }, [imoveis, imovelId]);

  const mesReferencia = `${mesInput}-01`;

  const { data, isLoading, error } = useQuery({
    queryKey: ["prestacao-contas", imovelId, mesReferencia],
    queryFn: () => fetchPrestacao({ data: { imovelId, mesReferencia } }),
    enabled: !!imovelId,
  });

  const despesasTotal = data?.despesas_total ?? 0;
  const valorRepasse = data?.repasse?.valor_repasse ?? 0;
  const liquidoFinal = data?.liquido_final ?? 0;

  const semRepasseGerado = !!imovelId && !isLoading && !data?.repasse;

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prestação de contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consolidado mensal por imóvel: aluguel repassado + despesas do imóvel no período.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 print:hidden">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Imóvel
          </label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={imovelId}
            onChange={(e) => setImovelId(e.target.value)}
          >
            {isLoadingImoveis ? (
              <option value="">Carregando…</option>
            ) : (
              (imoveis ?? []).length === 0 && (
                <option value="">Nenhum imóvel em locação ativa</option>
              )
            )}
            {(imoveis ?? []).map((im) => (
              <option key={im.id} value={im.id}>
                {im.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mês de referência
          </label>
          <input
            type="month"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={mesInput}
            onChange={(e) => setMesInput(e.target.value)}
          />
        </div>
      </div>

      {(imoveisError || error) && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {((imoveisError ?? error) as Error).message}
        </div>
      )}

      {isLoadingImoveis ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !imovelId ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum imóvel com contrato de locação ativo ainda.
          </p>
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-1 text-base font-semibold">{data?.imovel?.titulo ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              Contrato {data?.contrato?.numero ?? "—"} · Referência: {formatMesLabel(mesReferencia)}
            </p>
          </section>

          {semRepasseGerado ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum repasse gerado para este imóvel neste mês. Gere em{" "}
              <span className="font-medium text-foreground">Financeiro → Repasses (locação)</span>.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-semibold">Aluguel</h3>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Valor do aluguel</dt>
                  <dd className="text-right font-medium">
                    {formatBRL(data?.repasse?.valor_aluguel ?? 0)}
                  </dd>
                  <dt className="text-muted-foreground">
                    Taxa de administração ({data?.repasse?.taxa_admin_percentual ?? 0}%)
                  </dt>
                  <dd className="text-right font-medium text-red-600">
                    − {formatBRL(data?.repasse?.taxa_admin_valor ?? 0)}
                  </dd>
                  <dt className="text-muted-foreground">Outros descontos</dt>
                  <dd className="text-right font-medium text-red-600">
                    − {formatBRL(data?.repasse?.outros_descontos ?? 0)}
                  </dd>
                  <dt className="font-medium">Repasse líquido (antes de despesas do imóvel)</dt>
                  <dd className="text-right font-semibold">{formatBRL(valorRepasse)}</dd>
                  <dt className="text-muted-foreground">Status do repasse</dt>
                  <dd className="text-right text-muted-foreground">
                    {STATUS_LABEL[data?.repasse?.status ?? ""] ?? "—"}
                  </dd>
                </dl>
              </section>

              <section className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-semibold">Despesas do imóvel no período</h3>
                {data?.despesas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma despesa lançada.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="pb-2 text-left">Descrição</th>
                        <th className="pb-2 text-left">Categoria</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.despesas.map((d) => (
                        <tr key={d.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2">{d.descricao}</td>
                          <td className="py-2 text-muted-foreground">{d.categoria ?? "—"}</td>
                          <td className="py-2 text-right text-red-600">− {formatBRL(d.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-medium">
                  <span>Total de despesas</span>
                  <span className="text-red-600">− {formatBRL(despesasTotal)}</span>
                </div>
              </section>

              <section className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">
                    Valor final a repassar ao proprietário
                  </span>
                  <span className="text-2xl font-bold text-primary">{formatBRL(liquidoFinal)}</span>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
