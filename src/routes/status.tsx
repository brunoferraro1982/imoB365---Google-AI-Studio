import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Activity } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "Status — imob365" }] }),
  component: StatusPage,
});

function StatusPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/public/health");
        setData(await r.json());
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "erro");
      }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const ok = data?.status === "ok";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl p-8">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Status do sistema</h1>
        </div>

        <div
          className={`mt-6 rounded-xl border p-6 ${ok ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20" : "border-rose-500/40 bg-rose-50 dark:bg-rose-950/20"}`}
        >
          <div className="flex items-center gap-3">
            {ok ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <XCircle className="h-6 w-6 text-rose-600" />
            )}
            <div>
              <div className="text-lg font-semibold">
                {err ? "Indisponível" : ok ? "Todos os sistemas operacionais" : "Operação parcial"}
              </div>
              <div className="text-xs text-muted-foreground">
                Atualizado em {new Date().toLocaleTimeString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        {data && (
          <div className="mt-6 space-y-2">
            {Object.entries((data.checks ?? {}) as Record<string, any>).map(
              ([k, v]: [string, any]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <span className="font-medium capitalize">{k}</span>
                  <span className={v.status === "ok" ? "text-emerald-600" : "text-rose-600"}>
                    {v.status === "ok" ? "operacional" : v.error || "erro"}
                  </span>
                </div>
              ),
            )}
            <div className="text-right text-xs text-muted-foreground">
              Latência: {data.latency_ms}ms
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
