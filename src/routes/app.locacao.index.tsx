import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Home, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/locacao/")({
  component: LocacaoIndex,
});

function LocacaoIndex() {
  const { tenantId } = useAuth();
  const [contratos, setContratos] = useState<any[]>([]);
  const [os, setOs] = useState<any[]>([]);

  async function load() {
    if (!tenantId) return;
    const [{ data: c }, { data: o }] = await Promise.all([
      (supabase as any)
        .from("contratos")
        .select("id,numero,valor,status,data_inicio,data_fim,imovel:imoveis(titulo)")
        .eq("tenant_id", tenantId)
        .eq("tipo", "locacao")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("locacao_ordens_servico")
        .select("*,contrato:contratos(numero)")
        .eq("tenant_id", tenantId)
        .neq("status", "concluida")
        .order("aberta_em", { ascending: false })
        .limit(20),
    ]);
    setContratos(c ?? []);
    setOs(o ?? []);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex items-center gap-3">
        <Home className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Locação / Administração</h1>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Contratos de locação</h2>
        {contratos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato de locação. Crie um contrato com tipo "locação" em Jurídico.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contratos.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <Link
                    to="/app/contratos/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:underline"
                  >
                    {c.numero ?? c.id.slice(0, 8)}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {c.imovel?.titulo ?? "—"} · R$ {Number(c.valor).toLocaleString("pt-BR")} ·{" "}
                    {c.status}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Repasses ao proprietário</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Geração mensal, cálculo de taxa de administração e controle de status ficam em
              Financeiro.
            </p>
          </div>
          <Link to="/app/locacao/repasses">
            <Button size="sm" variant="outline">
              <Landmark className="mr-1 h-4 w-4" /> Ver repasses
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Ordens de serviço abertas</h2>
        {os.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma OS aberta.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {os.map((o) => (
              <li key={o.id} className="rounded border px-3 py-2">
                <b>{o.titulo}</b> · contrato {o.contrato?.numero ?? "—"} · {o.status} · prioridade{" "}
                {o.prioridade}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
