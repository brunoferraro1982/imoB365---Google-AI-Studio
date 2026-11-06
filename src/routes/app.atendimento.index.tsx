import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Headset,
  MessageCircle,
  Settings,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isModuleEnabled } from "@/lib/permissions";
import { calcularMetricasChamados, type ChamadoMetrico } from "@/lib/chamadosMetrics";
import { STATUS_LABEL, CATEGORIA_LABEL, CANAL_LABEL } from "@/lib/chamadosLabels";
import { SELO, TITULO_SECAO } from "@/components/portal/PaginaGlass";

export const Route = createFileRoute("/app/atendimento/")({
  component: PainelAtendimento,
});

// plans.slug reais: "pro"/"business" (mesma convenção do restante do app).
const PLANOS_AVANCADOS = ["pro", "business"];
const ABERTOS = ["novo", "em_atendimento", "aguardando_cliente"];

type Conversa = {
  id: string;
  assunto: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_corretor: number;
  corretor_user_id: string | null;
};

type ChamadoRow = ChamadoMetrico & {
  id: string;
  numero: string;
  assunto: string;
  prioridade: string;
  sla_prazo_primeira_resposta: string | null;
  sla_prazo_resolucao: string | null;
};

const ts = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/** "vencido há 3 h", "vence em 45 min", "em 2 d". */
function tempo(iso: string | null, agora: number) {
  const t = ts(iso);
  if (t == null) return "—";
  const diff = t - agora;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const txt =
    min < 60
      ? `${min} min`
      : min < 60 * 48
        ? `${Math.round(min / 60)} h`
        : `${Math.round(min / 1440)} d`;
  return diff < 0 ? `vencido há ${txt}` : `vence em ${txt}`;
}

function Kpi({
  label,
  value,
  sub,
  alerta,
}: {
  label: string;
  value: string;
  sub?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`glass-fosco rounded-2xl border p-5 ${
        alerta ? "border-red-500/50 ring-1 ring-red-500/30" : "border-white/40"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`pt-1 text-2xl font-black tracking-tight md:text-3xl ${
          alerta ? "text-red-600 dark:text-red-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PainelAtendimento() {
  const { tenantId, enabledModules, isSuperAdmin } = useAuth();
  const temCentral = isSuperAdmin || isModuleEnabled(enabledModules, "atendimento");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [chamados, setChamados] = useState<ChamadoRow[]>([]);
  const [planoAvancado, setPlanoAvancado] = useState(false);
  const [sla, setSla] = useState<{ resposta: number; resolucao: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const agora = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [conv, tenant, cfg] = await Promise.all([
        supabase
          .from("chat_conversations")
          .select(
            "id,assunto,last_message_at,last_message_preview,unread_corretor,corretor_user_id",
          )
          .eq("tenant_id", tenantId)
          .order("last_message_at", { ascending: false })
          .limit(200),
        supabase.from("tenants").select("plano_slug").eq("id", tenantId).maybeSingle(),
        supabase
          .from("tenant_atendimento_config")
          .select("sla_primeira_resposta_minutos,sla_resolucao_horas")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);
      setConversas((conv.data as Conversa[]) ?? []);
      setPlanoAvancado(
        PLANOS_AVANCADOS.includes((tenant.data as { plano_slug?: string })?.plano_slug ?? ""),
      );
      if (cfg.data) {
        setSla({
          resposta: Number(cfg.data.sla_primeira_resposta_minutos),
          resolucao: Number(cfg.data.sla_resolucao_horas),
        });
      }
      if (isSuperAdmin || isModuleEnabled(enabledModules, "atendimento")) {
        const { data } = await supabase
          .from("chamados")
          .select(
            "id,numero,assunto,prioridade,status,categoria,canal_origem,created_at,primeira_resposta_em,resolvido_em,csat_nota,sla_prazo_primeira_resposta,sla_prazo_resolucao",
          )
          .eq("responsavel_tipo", "tenant")
          .eq("tenant_id", tenantId);
        setChamados((data ?? []) as ChamadoRow[]);
      }
      setLoading(false);
    })();
  }, [tenantId, enabledModules, isSuperAdmin]);

  // Chat: conversas aguardando resposta do corretor.
  const aguardando = conversas.filter((c) => c.unread_corretor > 0);
  const naoLidas = aguardando.reduce((s, c) => s + c.unread_corretor, 0);

  // Chamados: abertos, estouros de SLA e próximos prazos.
  const abertos = chamados.filter((c) => ABERTOS.includes(c.status));
  const semResposta = abertos.filter((c) => !c.primeira_resposta_em);
  const respEstourado = semResposta.filter(
    (c) => (ts(c.sla_prazo_primeira_resposta) ?? Infinity) < agora,
  );
  const resEstourado = abertos.filter((c) => (ts(c.sla_prazo_resolucao) ?? Infinity) < agora);

  const comResposta = chamados.filter(
    (c) => c.primeira_resposta_em && c.sla_prazo_primeira_resposta,
  );
  const cumpreResp =
    comResposta.length > 0
      ? Math.round(
          (100 *
            comResposta.filter(
              (c) => ts(c.primeira_resposta_em)! <= ts(c.sla_prazo_primeira_resposta)!,
            ).length) /
            comResposta.length,
        )
      : null;
  const comResolucao = chamados.filter((c) => c.resolvido_em && c.sla_prazo_resolucao);
  const cumpreRes =
    comResolucao.length > 0
      ? Math.round(
          (100 *
            comResolucao.filter((c) => ts(c.resolvido_em)! <= ts(c.sla_prazo_resolucao)!).length) /
            comResolucao.length,
        )
      : null;

  const proximos = [...abertos]
    .map((c) => ({
      c,
      prazo: !c.primeira_resposta_em ? c.sla_prazo_primeira_resposta : c.sla_prazo_resolucao,
      tipo: !c.primeira_resposta_em ? "1ª resposta" : "resolução",
    }))
    .filter((x) => x.prazo)
    .sort((a, b) => ts(a.prazo)! - ts(b.prazo)!)
    .slice(0, 5);

  const m = calcularMetricasChamados(chamados);
  const estouros = respEstourado.length + resEstourado.length;

  return (
    <div className="mesh-brand-claro min-h-full">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <section className="glass-fosco rounded-3xl border border-white/40 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className={SELO}>Atendimento</span>
              <h1 className={`${TITULO_SECAO} mt-3`}>Conversas e chamados</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Tudo que pede resposta da sua equipe: conversas do chat, chamados da Central e os
                prazos de SLA.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/chat"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/30"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Conversas
              </Link>
              {temCentral && (
                <>
                  <Link
                    to="/app/atendimento/chamados"
                    className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white/70 px-4 py-2 text-xs font-bold text-primary dark:bg-white/5"
                  >
                    <Headset className="h-3.5 w-3.5" /> Chamados
                  </Link>
                  <Link
                    to="/app/configuracoes/atendimento-sla"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-xs font-semibold text-foreground dark:bg-white/5"
                  >
                    <Settings className="h-3.5 w-3.5" /> SLA e canais
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Conversas aguardando"
            value={loading ? "…" : String(aguardando.length)}
            sub={`${naoLidas} mensagem(ns) não lida(s)`}
          />
          <Kpi
            label="Chamados em aberto"
            value={temCentral ? (loading ? "…" : String(abertos.length)) : "—"}
            sub={
              temCentral
                ? `${semResposta.length} sem primeira resposta`
                : "Central não incluída no plano"
            }
          />
          <Kpi
            label="SLA estourado"
            value={temCentral ? (loading ? "…" : String(estouros)) : "—"}
            sub={
              temCentral
                ? `${respEstourado.length} de 1ª resposta · ${resEstourado.length} de resolução`
                : undefined
            }
            alerta={temCentral && estouros > 0}
          />
          <Kpi
            label="Cumprimento de SLA"
            value={cumpreResp != null ? `${cumpreResp}%` : "—"}
            sub={cumpreRes != null ? `Resolução: ${cumpreRes}%` : "Primeira resposta no prazo"}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-fosco rounded-3xl border border-white/40 p-6">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageCircle className="h-5 w-5 text-primary" /> Chat aguardando resposta
              </h2>
              <Link to="/app/chat" className="text-xs font-semibold text-primary">
                Ver todas <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-border/60">
              {aguardando.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma conversa aguardando resposta.
                </li>
              )}
              {aguardando.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/app/chat/$id"
                    params={{ id: c.id }}
                    className="flex items-start justify-between gap-3 py-3 hover:text-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.assunto || "Conversa"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.last_message_preview ?? ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {c.unread_corretor}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-fosco rounded-3xl border border-white/40 p-6">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Clock className="h-5 w-5 text-primary" /> Próximos prazos de chamados
              </h2>
              {temCentral && (
                <Link to="/app/atendimento/chamados" className="text-xs font-semibold text-primary">
                  Ver chamados <ArrowRight className="inline h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            {!temCentral ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                A Central de Atendimento não está incluída no seu plano.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {proximos.length === 0 && (
                  <li className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum chamado com prazo em aberto.
                  </li>
                )}
                {proximos.map(({ c, prazo, tipo }) => {
                  const vencido = (ts(prazo) ?? Infinity) < agora;
                  return (
                    <li key={c.id}>
                      <Link
                        to="/app/atendimento/chamados"
                        className="flex items-start justify-between gap-3 py-3 hover:text-primary"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            #{c.numero} · {c.assunto}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {STATUS_LABEL[c.status] ?? c.status} · prazo de {tipo}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            vencido
                              ? "bg-red-600 text-white"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          }`}
                        >
                          {tempo(prazo, agora)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {temCentral && (
          <section className="glass-fosco rounded-3xl border border-white/40 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <h2 className="text-lg font-bold">SLA e satisfação</h2>
              <Link
                to="/app/configuracoes/atendimento-sla"
                className="text-xs font-semibold text-primary"
              >
                Ajustar prazos <ArrowRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Kpi
                label="Prazo de 1ª resposta"
                value={sla ? `${sla.resposta} min` : "240 min"}
                sub="Padrão quando não personalizado"
              />
              <Kpi label="Prazo de resolução" value={sla ? `${sla.resolucao} h` : "48 h"} />
              <Kpi
                label="Tempo médio 1ª resposta"
                value={
                  planoAvancado && m.tempoMedioRespostaMin != null
                    ? `${m.tempoMedioRespostaMin} min`
                    : "—"
                }
                sub={planoAvancado ? undefined : "Disponível nos planos Pro e Business"}
              />
              <Kpi
                label="Satisfação (CSAT)"
                value={planoAvancado && m.csatMedio != null ? `${m.csatMedio} / 5` : "—"}
                sub={
                  planoAvancado
                    ? `${m.csatRespostas} avaliação(ões)`
                    : "Disponível nos planos Pro e Business"
                }
              />
            </div>
            {planoAvancado && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {m.porCanal.map((i) => (
                  <span
                    key={i.chave}
                    className="rounded-full bg-white/70 px-3 py-1 font-semibold dark:bg-white/5"
                  >
                    {CANAL_LABEL[i.chave] ?? i.chave}: {i.total}
                  </span>
                ))}
                {m.porCategoria.map((i) => (
                  <span
                    key={i.chave}
                    className="rounded-full bg-white/70 px-3 py-1 font-semibold dark:bg-white/5"
                  >
                    {CATEGORIA_LABEL[i.chave] ?? i.chave}: {i.total}
                  </span>
                ))}
              </div>
            )}
            {estouros > 0 && (
              <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" /> {estouros} prazo(s) de SLA estourado(s) —
                priorize os chamados em vermelho.
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Star className="h-3 w-3" /> Métricas avançadas (CSAT, canais e categorias) ficam nos
              planos Pro e Business.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
