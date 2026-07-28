import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, ChevronRight } from "lucide-react";
import { podeAgirNaEtapa, type EtapaContrato } from "@/lib/permissions";

// Sequência fixa do workflow (CLM) — texto livre no banco (contrato_etapas
// não usa enum, ver migration 20260728160000), a ordem aqui é só a
// convenção de UI/avanço padrão do stepper.
const ETAPAS: { value: EtapaContrato; label: string }[] = [
  { value: "captacao", label: "Captação" },
  { value: "analise", label: "Análise" },
  { value: "documentacao", label: "Documentação" },
  { value: "juridico", label: "Jurídico" },
  { value: "assinatura", label: "Assinatura" },
  { value: "ativacao", label: "Ativação" },
  { value: "financeiro", label: "Financeiro" },
  { value: "administracao", label: "Administração" },
  { value: "encerramento", label: "Encerramento" },
];

type HistoricoEtapa = {
  id: string;
  etapa: string;
  iniciada_em: string;
  concluida_em: string | null;
};

export function EtapasStepper({ contratoId }: { contratoId: string }) {
  const { tenantId, roles } = useAuth();
  const [etapaAtual, setEtapaAtual] = useState<EtapaContrato | null>(null);
  const [historico, setHistorico] = useState<HistoricoEtapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [avancando, setAvancando] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: contrato }, { data: etapas }] = await Promise.all([
      (supabase as any).from("contratos").select("etapa_atual").eq("id", contratoId).maybeSingle(),
      (supabase as any)
        .from("contrato_etapas")
        .select("id,etapa,iniciada_em,concluida_em")
        .eq("contrato_id", contratoId)
        .order("iniciada_em", { ascending: false }),
    ]);
    setEtapaAtual((contrato?.etapa_atual as EtapaContrato) ?? "captacao");
    setHistorico((etapas ?? []) as HistoricoEtapa[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contratoId]);

  const indiceAtual = etapaAtual ? ETAPAS.findIndex((e) => e.value === etapaAtual) : -1;
  const proximaEtapa =
    indiceAtual >= 0 && indiceAtual < ETAPAS.length - 1 ? ETAPAS[indiceAtual + 1] : null;

  const podeAvancar = etapaAtual != null && podeAgirNaEtapa(roles ?? [], etapaAtual, "write");

  async function avancarEtapa() {
    if (!tenantId || !proximaEtapa || !etapaAtual) return;
    setAvancando(true);
    try {
      const agora = new Date().toISOString();
      // Fecha a etapa atual (se houver uma linha em aberto) e abre a próxima
      // — mesmo padrão de "histórico de transições" já usado em outros
      // lugares do projeto (ex. status_incident_updates).
      const emAberto = historico.find((h) => h.etapa === etapaAtual && !h.concluida_em);
      if (emAberto) {
        await (supabase as any)
          .from("contrato_etapas")
          .update({ concluida_em: agora })
          .eq("id", emAberto.id);
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await (supabase as any).from("contrato_etapas").insert({
        tenant_id: tenantId,
        contrato_id: contratoId,
        etapa: proximaEtapa.value,
        responsavel_user_id: user?.id ?? null,
      });
      await (supabase as any)
        .from("contratos")
        .update({ etapa_atual: proximaEtapa.value })
        .eq("id", contratoId);
      toast.success(`Etapa avançada para "${proximaEtapa.label}"`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao avançar etapa");
    } finally {
      setAvancando(false);
    }
  }

  if (loading || !etapaAtual) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Carregando etapa…
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Workflow do contrato</h2>
        {proximaEtapa && (
          <Button size="sm" onClick={avancarEtapa} disabled={!podeAvancar || avancando}>
            {avancando ? "Avançando…" : `Avançar para "${proximaEtapa.label}"`}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 overflow-x-auto">
        {ETAPAS.map((etapa, idx) => {
          const passou = idx < indiceAtual;
          const atual = idx === indiceAtual;
          return (
            <div key={etapa.value} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
                  atual
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : passou
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
                }`}
              >
                {passou && <Check className="h-3 w-3" />}
                {etapa.label}
              </div>
              {idx < ETAPAS.length - 1 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      {!podeAvancar && proximaEtapa && (
        <p className="mt-3 text-xs text-muted-foreground">
          Seu papel não tem permissão para avançar a etapa atual ({ETAPAS[indiceAtual]?.label}).
        </p>
      )}

      {historico.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {historico.slice(0, 5).map((h) => (
            <li key={h.id}>
              {ETAPAS.find((e) => e.value === h.etapa)?.label ?? h.etapa} —{" "}
              {new Date(h.iniciada_em).toLocaleString("pt-BR")}
              {h.concluida_em && ` até ${new Date(h.concluida_em).toLocaleString("pt-BR")}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
