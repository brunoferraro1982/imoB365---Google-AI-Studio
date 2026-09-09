import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Target, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  criarRascunhoCampanha,
  iniciarPagamentoCampanha,
  listarMinhasCampanhas,
  consultarPerformanceCampanha,
  type PerformanceCampanha,
} from "@/lib/googleAdsCampanhas.functions";
import { formatBRL } from "@/lib/format";

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  aguardando_pagamento: { label: "Aguardando pagamento", variant: "secondary" },
  aguardando_ativacao: { label: "Em análise", variant: "secondary" },
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  encerrada: { label: "Encerrada", variant: "secondary" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

const TIPO_LABEL: Record<string, string> = {
  search: "Rede de Pesquisa",
  display: "Rede de Display",
  video: "Vídeo",
  shopping: "Shopping",
};

// Google Ads — a imobiliária/corretor monta e paga a campanha aqui, mas
// NUNCA vê o orçamento de mídia bruto nem a margem da imoB365 (só o valor
// final já calculado) — decisão explícita do usuário. A ativação real
// (que gera gasto no cartão da própria imoB365) é feita só pelo
// super_admin em /admin/google-ads.
export const Route = createFileRoute("/app/marketing/google-ads")({
  head: () => ({ meta: [{ title: "Google Ads — imob365" }] }),
  component: GoogleAdsTenantPage,
});

function GoogleAdsTenantPage() {
  const [form, setForm] = useState({
    nome: "",
    palavrasChave: "",
    tipoConteudo: "search",
    orcamentoPeriodo: "",
    duracaoDias: "30",
  });
  const [criando, setCriando] = useState(false);
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [performance, setPerformance] = useState<Record<string, PerformanceCampanha | null>>({});
  const [carregandoPerformance, setCarregandoPerformance] = useState<string | null>(null);

  const criar = useServerFn(criarRascunhoCampanha);
  const pagar = useServerFn(iniciarPagamentoCampanha);
  const listar = useServerFn(listarMinhasCampanhas);
  const buscarPerformance = useServerFn(consultarPerformanceCampanha);

  const {
    data: campanhas,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["minhas-campanhas-google-ads"],
    queryFn: () => listar(),
  });

  async function onCriar() {
    const orcamento = Number(form.orcamentoPeriodo);
    const duracao = Number(form.duracaoDias);
    if (!form.nome.trim() || !form.palavrasChave.trim() || !orcamento || !duracao) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setCriando(true);
    try {
      const { valorTotal } = await criar({
        data: {
          nome: form.nome.trim(),
          palavrasChave: form.palavrasChave.trim(),
          tipoConteudo: form.tipoConteudo as "search" | "display" | "video" | "shopping",
          orcamentoPeriodo: orcamento,
          duracaoDias: duracao,
        },
      });
      toast.success(`Campanha criada — investimento total: ${formatBRL(valorTotal)}`);
      setForm({
        nome: "",
        palavrasChave: "",
        tipoConteudo: "search",
        orcamentoPeriodo: "",
        duracaoDias: "30",
      });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar campanha");
    } finally {
      setCriando(false);
    }
  }

  async function onPagar(campanhaId: string) {
    setPagandoId(campanhaId);
    try {
      const { checkoutUrl } = await pagar({ data: { campanhaId } });
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar pagamento");
      setPagandoId(null);
    }
  }

  async function onVerPerformance(campanhaId: string) {
    setCarregandoPerformance(campanhaId);
    try {
      const dados = await buscarPerformance({ data: { campanhaId } });
      setPerformance((p) => ({ ...p, [campanhaId]: dados }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar performance");
    } finally {
      setCarregandoPerformance(null);
    }
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Target className="h-7 w-7 text-primary" /> Google Ads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte sua campanha, pague o investimento e acompanhe o resultado — a ativação é feita pela
          equipe imob365 depois da confirmação do pagamento.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="h-fit space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Nova campanha</h2>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da campanha</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="ex.: Apartamentos Zona Sul"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Palavras-chave</Label>
            <Input
              value={form.palavrasChave}
              onChange={(e) => setForm((f) => ({ ...f, palavrasChave: e.target.value }))}
              placeholder="apartamento 2 quartos, imóvel zona sul, ..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de anúncio</Label>
            <Select
              value={form.tipoConteudo}
              onValueChange={(v) => setForm((f) => ({ ...f, tipoConteudo: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="search">Rede de Pesquisa</SelectItem>
                <SelectItem value="display">Rede de Display</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Orçamento do período (R$)</Label>
              <Input
                type="number"
                min={1}
                value={form.orcamentoPeriodo}
                onChange={(e) => setForm((f) => ({ ...f, orcamentoPeriodo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duração (dias)</Label>
              <Input
                type="number"
                min={1}
                value={form.duracaoDias}
                onChange={(e) => setForm((f) => ({ ...f, duracaoDias: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={onCriar} disabled={criando} className="w-full">
            {criando ? "Criando…" : "Calcular e criar campanha"}
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Minhas campanhas</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !campanhas || campanhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
          ) : (
            campanhas.map((c: any) => {
              const st = STATUS_LABEL[c.status] ?? {
                label: c.status,
                variant: "secondary" as const,
              };
              const perf = performance[c.id];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {TIPO_LABEL[c.tipo_conteudo] ?? c.tipo_conteudo} · {c.duracao_dias} dias ·
                        Investimento total: {formatBRL(c.valor_com_margem)}
                      </p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>

                  {c.status === "rascunho" && (
                    <Button size="sm" onClick={() => onPagar(c.id)} disabled={pagandoId === c.id}>
                      {pagandoId === c.id ? "Redirecionando…" : "Pagar e enviar pra ativação"}
                    </Button>
                  )}

                  {c.status === "rejeitada" && c.motivo_rejeicao && (
                    <p className="text-xs text-destructive">Motivo: {c.motivo_rejeicao}</p>
                  )}

                  {c.status === "ativa" && (
                    <div className="mt-2 border-t border-border pt-3">
                      {perf ? (
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Impressões</p>
                            <p className="font-semibold">
                              {perf.impressions.toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Cliques</p>
                            <p className="font-semibold">{perf.clicks.toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Custo</p>
                            <p className="font-semibold">
                              {formatBRL(perf.costMicros / 1_000_000)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Conversões</p>
                            <p className="font-semibold">
                              {perf.conversions.toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onVerPerformance(c.id)}
                          disabled={carregandoPerformance === c.id}
                        >
                          {carregandoPerformance === c.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BarChart3 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Ver performance
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
