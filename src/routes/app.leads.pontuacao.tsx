import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/pontuacao")({
  component: PontuacaoPage,
});

// Só eventos que o sistema já registra de verdade (ver trigger tg_score_* no banco).
const EVENTOS = [
  {
    evento: "lead.criado",
    label: "Lead criado",
    ajuda: "Quando um lead entra na plataforma por qualquer canal.",
  },
  {
    evento: "lead.contatado",
    label: "Lead em contato",
    ajuda: "Quando o lead passa para a categoria Em contato.",
  },
  {
    evento: "lead.visita_marcada",
    label: "Visita marcada",
    ajuda: "Quando uma visita é agendada para o lead.",
  },
  {
    evento: "lead.visita_realizada",
    label: "Visita realizada",
    ajuda: "Quando a visita ligada ao lead é marcada como realizada.",
  },
  {
    evento: "lead.proposta",
    label: "Proposta",
    ajuda: "Quando o lead passa para a categoria Proposta.",
  },
];

type Regra = { id: string; evento: string; pontos: number; ativo: boolean };

function PontuacaoPage() {
  const { tenantId } = useAuth();
  const [regras, setRegras] = useState<Record<string, Regra>>({});
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_scoring_regras")
      .select("id,evento,pontos,ativo")
      .eq("tenant_id", tenantId);
    if (error) toast.error(error.message);
    const mapa: Record<string, Regra> = {};
    for (const r of (data as Regra[]) ?? []) mapa[r.evento] = r;
    setRegras(mapa);
    setRascunho({});
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function salvar(evento: string) {
    if (!tenantId) return;
    const valor = Number(rascunho[evento]);
    if (!Number.isInteger(valor) || valor < -1000 || valor > 1000) {
      return toast.error("Informe um número inteiro entre -1000 e 1000.");
    }
    const atual = regras[evento];
    const { error } = atual
      ? await (supabase as any)
          .from("lead_scoring_regras")
          .update({ pontos: valor })
          .eq("id", atual.id)
      : await (supabase as any)
          .from("lead_scoring_regras")
          .insert({ tenant_id: tenantId, evento, pontos: valor, ativo: true });
    if (error) return toast.error(error.message);
    toast.success(
      "Pontuação salva. Vale para os próximos eventos; use Recalcular para atualizar os leads atuais.",
    );
    load();
  }

  async function alternar(r: Regra) {
    const { error } = await (supabase as any)
      .from("lead_scoring_regras")
      .update({ ativo: !r.ativo })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function recalcular() {
    if (!tenantId) return;
    setRecalculando(true);
    const { data, error } = await (supabase as any).rpc("recalcular_scores_tenant", {
      _tenant: tenantId,
    });
    setRecalculando(false);
    if (error) return toast.error(error.message);
    toast.success(`Pontuação recalculada em ${data ?? 0} lead(s).`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        to="/app/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Leads
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Pontuação de leads</h1>
        </div>
        <Button variant="outline" onClick={recalcular} disabled={recalculando}>
          {recalculando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Recalcular scores
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">
        Cada evento vale os pontos abaixo. O score do lead é a soma dos eventos que ele já teve e
        aparece no card do kanban. Pontos negativos são aceitos (ex.: -5 para lead sem resposta, se
        você criar essa regra no futuro).
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="space-y-3">
          {EVENTOS.map((ev) => {
            const r = regras[ev.evento];
            const valor = rascunho[ev.evento] ?? (r ? String(r.pontos) : "");
            return (
              <div
                key={ev.evento}
                className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="font-medium">{ev.label}</div>
                  <div className="text-xs text-muted-foreground">{ev.ajuda}</div>
                </div>
                <Input
                  type="number"
                  className="w-24"
                  value={valor}
                  placeholder="0"
                  onChange={(e) => setRascunho((s) => ({ ...s, [ev.evento]: e.target.value }))}
                  aria-label={`Pontos de ${ev.label}`}
                />
                <Button
                  size="sm"
                  onClick={() => salvar(ev.evento)}
                  disabled={rascunho[ev.evento] === undefined}
                >
                  Salvar
                </Button>
                {r && (
                  <Button size="sm" variant="ghost" onClick={() => alternar(r)}>
                    {r.ativo ? "Desativar" : "Ativar"}
                  </Button>
                )}
                {r && !r.ativo && <span className="text-xs text-muted-foreground">desativada</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
