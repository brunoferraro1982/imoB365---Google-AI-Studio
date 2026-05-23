import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Home, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/app/locacao/")({
  component: LocacaoIndex,
});

function LocacaoIndex() {
  const { tenantId } = useAuth();
  const [contratos, setContratos] = useState<any[]>([]);
  const [repasses, setRepasses] = useState<any[]>([]);
  const [os, setOs] = useState<any[]>([]);

  async function load() {
    if (!tenantId) return;
    const [{ data: c }, { data: r }, { data: o }] = await Promise.all([
      (supabase as any).from("contratos").select("id,numero,valor,status,data_inicio,data_fim,imovel:imoveis(titulo)").eq("tenant_id", tenantId).eq("tipo", "locacao").order("created_at", { ascending: false }),
      (supabase as any).from("locacao_repasses").select("*,contrato:contratos(numero)").eq("tenant_id", tenantId).order("mes_referencia", { ascending: false }).limit(50),
      (supabase as any).from("locacao_ordens_servico").select("*,contrato:contratos(numero)").eq("tenant_id", tenantId).neq("status", "concluida").order("aberta_em", { ascending: false }).limit(20),
    ]);
    setContratos(c ?? []); setRepasses(r ?? []); setOs(o ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function gerarRepasse(contrato: any) {
    const mes = new Date(); mes.setDate(1);
    const { error } = await (supabase as any).from("locacao_repasses").insert({
      tenant_id: tenantId, contrato_id: contrato.id,
      mes_referencia: mes.toISOString().slice(0, 10),
      valor_aluguel: contrato.valor, valor_repasse: contrato.valor,
    });
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex items-center gap-3">
        <Home className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Locação / Administração</h1>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Contratos de locação</h2>
        {contratos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato de locação. Crie um contrato com tipo "locação" em Jurídico.</p> : (
          <ul className="space-y-2 text-sm">
            {contratos.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <Link to="/app/contratos/$id" params={{ id: c.id }} className="font-medium hover:underline">{c.numero ?? c.id.slice(0,8)}</Link>
                  <div className="text-xs text-muted-foreground">{c.imovel?.titulo ?? "—"} · R$ {Number(c.valor).toLocaleString("pt-BR")} · {c.status}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => gerarRepasse(c)}><Plus className="mr-1 h-4 w-4" /> Repasse do mês</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Repasses recentes</h2>
        {repasses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum repasse registrado.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Contrato</th><th>Mês</th><th>Aluguel</th><th>Repasse</th><th>Status</th></tr></thead>
            <tbody>
              {repasses.map((r) => (
                <tr key={r.id} className="border-t">
                  <td>{r.contrato?.numero ?? "—"}</td>
                  <td className="text-center">{new Date(r.mes_referencia).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</td>
                  <td className="text-center">R$ {Number(r.valor_aluguel).toLocaleString("pt-BR")}</td>
                  <td className="text-center">R$ {Number(r.valor_repasse).toLocaleString("pt-BR")}</td>
                  <td className="text-center">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Ordens de serviço abertas</h2>
        {os.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma OS aberta.</p> : (
          <ul className="space-y-1 text-sm">
            {os.map((o) => (
              <li key={o.id} className="rounded border px-3 py-2">
                <b>{o.titulo}</b> · contrato {o.contrato?.numero ?? "—"} · {o.status} · prioridade {o.prioridade}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}