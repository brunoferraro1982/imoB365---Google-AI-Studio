import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Radar,
  Search,
  Timer,
  XCircle,
} from "lucide-react";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buscarResumoHistorico, type ResumoDiario, type StatusValue } from "@/lib/statusPage";

type ServicoStatus = {
  slug: string;
  nome: string;
  descricao: string | null;
  status: StatusValue;
  historico: ResumoDiario[];
};

type IncidenteResumo = {
  id: string;
  titulo: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impacto: "minor" | "major" | "critical";
  started_at: string;
  resolved_at: string | null;
  updates: { status: string; mensagem: string; created_at: string }[];
};

const GRAVIDADE: Record<StatusValue, number> = { operational: 0, degraded: 1, outage: 2 };

const fetchStatusPageData = createServerFn({ method: "GET" }).handler(async () => {
  const { data: services } = await (supabaseAdmin as any)
    .from("status_services")
    .select("id,slug,nome_exibicao,descricao")
    .eq("publico", true)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const lista = (services ?? []) as {
    id: string;
    slug: string;
    nome_exibicao: string;
    descricao: string | null;
  }[];

  const servicos: ServicoStatus[] = await Promise.all(
    lista.map(async (s) => {
      const { data: ultimo } = await (supabaseAdmin as any)
        .from("status_checks")
        .select("status")
        .eq("service_id", s.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const historico = await buscarResumoHistorico(s.id, 90);
      return {
        slug: s.slug,
        nome: s.nome_exibicao,
        descricao: s.descricao,
        status: (ultimo?.status as StatusValue | undefined) ?? "operational",
        historico,
      };
    }),
  );

  const { data: incidentesRaw } = await (supabaseAdmin as any)
    .from("status_incidents")
    .select(
      "id,titulo,status,impacto,started_at,resolved_at,status_incident_updates(status,mensagem,created_at)",
    )
    .order("started_at", { ascending: false })
    .limit(20);

  const incidentes: IncidenteResumo[] = ((incidentesRaw ?? []) as any[]).map((i) => ({
    id: i.id,
    titulo: i.titulo,
    status: i.status,
    impacto: i.impacto,
    started_at: i.started_at,
    resolved_at: i.resolved_at,
    updates: (i.status_incident_updates ?? []).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  }));

  return { servicos, incidentes };
});

export const Route = createFileRoute("/status")({
  loader: async () => fetchStatusPageData(),
  head: () => ({
    meta: [
      { title: "Status — imob365" },
      {
        name: "description",
        content:
          "Status em tempo real dos serviços da plataforma imob365: aplicação, banco de dados, autenticação, armazenamento, tempo real e assistente de IA.",
      },
    ],
  }),
  component: StatusPage,
});

const STATUS_LABEL: Record<StatusValue, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  outage: "Fora do ar",
};

const IMPACTO_LABEL: Record<IncidenteResumo["impacto"], string> = {
  minor: "Menor",
  major: "Relevante",
  critical: "Crítico",
};

const INCIDENT_STATUS_LABEL: Record<IncidenteResumo["status"], string> = {
  investigating: "Investigando",
  identified: "Identificado",
  monitoring: "Monitorando",
  resolved: "Resolvido",
};

function StatusPill({ status }: { status: StatusValue }) {
  const config = {
    operational: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
    degraded: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
    outage: { icon: XCircle, cls: "text-red-600 dark:text-red-400" },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.cls}`}>
      <Icon className="h-4 w-4" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function HistoricoStrip({ historico }: { historico: ResumoDiario[] }) {
  const corPorStatus: Record<ResumoDiario["status"], string> = {
    operational: "bg-emerald-500",
    degraded: "bg-amber-500",
    outage: "bg-red-500",
    "sem-dado": "bg-muted",
  };
  return (
    <div className="flex gap-[2px]">
      {historico.map((dia) => (
        <div
          key={dia.data}
          title={`${dia.data} — ${dia.status === "sem-dado" ? "sem dado" : STATUS_LABEL[dia.status]}`}
          className={`h-8 flex-1 rounded-sm ${corPorStatus[dia.status]}`}
        />
      ))}
    </div>
  );
}

const FLUXO_MONITORAMENTO: Etapa[] = [
  { icon: Timer, titulo: "Checagem", texto: "Automática a cada 5 minutos" },
  { icon: Radar, titulo: "Detecção", texto: "Falha ou lentidão registrada" },
  { icon: Search, titulo: "Investigação", texto: "Causa identificada pela equipe" },
  { icon: Eye, titulo: "Monitoramento", texto: "Correção acompanhada aqui" },
];

function StatusPage() {
  const { servicos, incidentes } = Route.useLoaderData();

  const piorStatus = servicos.reduce<StatusValue>(
    (pior, s) => (GRAVIDADE[s.status] > GRAVIDADE[pior] ? s.status : pior),
    "operational",
  );

  const bannerConfig = {
    operational: {
      texto: "Todos os sistemas operacionais",
      cls: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300",
    },
    degraded: {
      texto: "Alguns serviços com degradação",
      cls: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
    },
    outage: {
      texto: "Interrupção em andamento em pelo menos um serviço",
      cls: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300",
    },
  }[piorStatus];

  const incidentesAbertos = incidentes.filter((i) => i.status !== "resolved");
  const incidentesResolvidos = incidentes.filter((i) => i.status === "resolved");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Status"
          seloIcon={Activity}
          titulo="Status da plataforma"
          destaque="monitorado a cada 5 minutos."
          subtitulo={
            <>
              Horários em UTC.{" "}
              <a
                href="/api/public/status.json"
                className="text-primary underline underline-offset-2"
              >
                Ver como JSON
              </a>
              .
            </>
          }
        >
          <div
            className={`mx-auto inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold ${bannerConfig.cls}`}
          >
            <StatusPill status={piorStatus} /> <span>· {bannerConfig.texto}</span>
          </div>
        </HeroGlass>

        <section className={BLOCO_CINZA}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>Serviços</span>
              <h2 className={TITULO_SECAO}>Disponibilidade nos últimos 90 dias</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {servicos.map((s) => (
                <div key={s.slug} className={`${CARD_GLASS} p-5`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold">{s.nome}</div>
                      {s.descricao && (
                        <div className="text-xs text-muted-foreground">{s.descricao}</div>
                      )}
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  <div className="mt-3">
                    <HistoricoStrip historico={s.historico} />
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>90 dias atrás</span>
                      <span>hoje</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Como monitoramos</span>
              <h2 className={TITULO_SECAO}>Da checagem à solução</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Cada serviço é checado automaticamente a cada 5 minutos. Quando algo sai do normal,
                o incidente é aberto aqui e atualizado a cada etapa até a solução.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nota técnica: as checagens rodam a partir da própria infraestrutura da plataforma.
                Numa interrupção total do servidor, este status pode ficar temporariamente
                desatualizado em vez de refletir "fora do ar" — para esse cenário, uma checagem
                externa independente é o próximo passo de evolução deste monitoramento.
              </p>
            </div>
            <Fluxograma
              titulo="Monitoramento e incidentes"
              legenda="Fluxo de monitoramento"
              etapas={FLUXO_MONITORAMENTO}
              resultado="Serviço normalizado e registrado"
            />
          </div>
        </section>

        <section className={BLOCO_CINZA}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>Incidentes</span>
              <h2 className={TITULO_SECAO}>Histórico de incidentes</h2>
            </div>
            {incidentesAbertos.length === 0 && incidentesResolvidos.length === 0 && (
              <div className={`${CARD_GLASS} flex items-center gap-3 p-5 text-sm`}>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Nenhum incidente registrado nos últimos períodos.
              </div>
            )}
            <div className="space-y-3">
              {[...incidentesAbertos, ...incidentesResolvidos].map((i) => (
                <IncidenteCard key={i.id} incidente={i} />
              ))}
            </div>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}

function IncidenteCard({ incidente }: { incidente: IncidenteResumo }) {
  return (
    <div className={`${CARD_GLASS} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold">{incidente.titulo}</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            {IMPACTO_LABEL[incidente.impacto]}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            {INCIDENT_STATUS_LABEL[incidente.status]}
          </span>
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Início: {new Date(incidente.started_at).toLocaleString("pt-BR")}
        {incidente.resolved_at &&
          ` · Resolvido: ${new Date(incidente.resolved_at).toLocaleString("pt-BR")}`}
      </div>
      {incidente.updates.length > 0 && (
        <ul className="mt-3 space-y-2 border-l border-border pl-4">
          {incidente.updates.map((u, idx) => (
            <li key={idx} className="text-sm">
              <span className="text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="ml-2 font-medium">
                {INCIDENT_STATUS_LABEL[u.status as IncidenteResumo["status"]]}:
              </span>{" "}
              {u.mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
