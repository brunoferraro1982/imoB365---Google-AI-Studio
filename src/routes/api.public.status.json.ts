import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buscarResumoHistorico, type StatusValue } from "@/lib/statusPage";

const GRAVIDADE: Record<StatusValue, number> = { operational: 0, degraded: 1, outage: 2 };

// Feed JSON público (sem auth, cacheável) com o status atual de cada
// serviço + os últimos 90 dias resumidos por dia. Serve tanto de "link de
// dados" na própria /status (mesmo padrão do Google Status) quanto de ponto
// de extensão futuro: quando uma ferramenta externa (Zabbix, Datadog) for
// conectada de verdade, ela pode consumir este mesmo formato sem precisar
// de nenhuma mudança de código aqui.
export const Route = createFileRoute("/api/public/status/json")({
  server: {
    handlers: {
      GET: async () => {
        const { data: services } = await (supabaseAdmin as any)
          .from("status_services")
          .select("id,slug,nome_exibicao,descricao,ordem")
          .eq("publico", true)
          .eq("ativo", true)
          .order("ordem", { ascending: true });

        const lista = (services ?? []) as {
          id: string;
          slug: string;
          nome_exibicao: string;
          descricao: string | null;
        }[];

        const componentes = await Promise.all(
          lista.map(
            async (s: {
              id: string;
              slug: string;
              nome_exibicao: string;
              descricao: string | null;
            }): Promise<{
              slug: string;
              nome: string;
              descricao: string | null;
              status: StatusValue;
              latencyMs: number | null;
              checadoEm: string | null;
              historico90dias: Awaited<ReturnType<typeof buscarResumoHistorico>>;
            }> => {
              const { data: ultimo } = await (supabaseAdmin as any)
                .from("status_checks")
                .select("status,latency_ms,checked_at")
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
                latencyMs: ultimo?.latency_ms ?? null,
                checadoEm: ultimo?.checked_at ?? null,
                historico90dias: historico,
              };
            },
          ),
        );

        const piorStatus = componentes.reduce<StatusValue>((pior, c) => {
          return GRAVIDADE[c.status] > GRAVIDADE[pior] ? c.status : pior;
        }, "operational");

        const { data: incidentesAbertos } = await (supabaseAdmin as any)
          .from("status_incidents")
          .select("id,titulo,status,impacto,started_at")
          .neq("status", "resolved")
          .order("started_at", { ascending: false });

        const body = {
          status: piorStatus,
          geradoEm: new Date().toISOString(),
          componentes,
          incidentesAbertos: incidentesAbertos ?? [],
        };

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
