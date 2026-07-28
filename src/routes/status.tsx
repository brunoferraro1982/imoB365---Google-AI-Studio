import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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

      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Status da plataforma</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualizado automaticamente a cada 5 minutos. Horários em UTC.{" "}
          <a
            href="/api/public/status.json"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Ver como JSON
          </a>
          .
        </p>

        <div className={`mt-8 rounded-xl border px-5 py-4 text-sm font-medium ${bannerConfig.cls}`}>
          {bannerConfig.texto}
        </div>

        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {servicos.map((s) => (
            <div key={s.slug} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{s.nome}</div>
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

        <p className="mt-4 text-xs text-muted-foreground">
          Nota técnica: as checagens rodam a partir da própria infraestrutura da plataforma. Numa
          interrupção total do servidor, este status pode ficar temporariamente desatualizado em vez
          de refletir "fora do ar" — para esse cenário, uma checagem externa independente é o
          próximo passo de evolução deste monitoramento.
        </p>

        <h2 className="mt-12 text-xl font-semibold tracking-tight">Histórico de incidentes</h2>

        {incidentesAbertos.length === 0 && incidentesResolvidos.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum incidente registrado nos últimos períodos.
          </p>
        )}

        {incidentesAbertos.length > 0 && (
          <div className="mt-4 space-y-3">
            {incidentesAbertos.map((i) => (
              <IncidenteCard key={i.id} incidente={i} />
            ))}
          </div>
        )}

        {incidentesResolvidos.length > 0 && (
          <div className="mt-4 space-y-3">
            {incidentesResolvidos.map((i) => (
              <IncidenteCard key={i.id} incidente={i} />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

function IncidenteCard({ incidente }: { incidente: IncidenteResumo }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{incidente.titulo}</div>
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
