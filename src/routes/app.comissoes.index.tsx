import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wallet, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/comissoes/")({
  head: () => ({ meta: [{ title: "Comissões — imob365" }] }),
  component: ComissoesList,
});

const STATUS_LABEL: Record<string, string> = {
  a_pagar: "A pagar",
  paga: "Paga",
  cancelada: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paga: "default",
  a_pagar: "secondary",
  cancelada: "outline",
};

function ComissoesList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "a_pagar" | "paga" | "cancelada">("todos");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("comissoes")
      .select(
        "id,valor,percentual,status,data_prevista,data_pagamento,observacoes,corretor:corretores(id,nome),contrato:contratos(id,numero,valor)",
      )
      .order("data_prevista", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function marcarPaga(id: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("comissoes")
      .update({ status: "paga", data_pagamento: hoje })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comissão paga e lançamento criado");
    load();
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar esta comissão?")) return;
    const { error } = await supabase.from("comissoes").update({ status: "cancelada" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comissão cancelada");
    load();
  }

  const filtered = items.filter((c) => {
    if (filter !== "todos" && c.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.corretor?.nome ?? "").toLowerCase().includes(q) ||
      (c.contrato?.numero ?? "").toLowerCase().includes(q)
    );
  });

  const totals = useMemo(() => {
    let aPagar = 0,
      pagas = 0;
    for (const c of items) {
      const v = Number(c.valor) || 0;
      if (c.status === "a_pagar") aPagar += v;
      else if (c.status === "paga") pagas += v;
    }
    return { aPagar, pagas, total: aPagar + pagas };
  }, [items]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Geradas automaticamente quando o contrato fica ativo.
          </p>
        </div>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="A pagar" value={formatBRL(totals.aPagar)} className="text-amber-600" />
        <Stat label="Pagas" value={formatBRL(totals.pagas)} className="text-emerald-600" />
        <Stat label="Total" value={formatBRL(totals.total)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por corretor ou contrato…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {(["todos", "a_pagar", "paga", "cancelada"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todas" : STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma comissão ainda. Ative um contrato para gerar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Corretor</th>
                <th className="px-4 py-3 text-left">Contrato</th>
                <th className="px-4 py-3 text-left">Previsão</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{c.corretor?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.contrato ? (
                      <Link
                        to="/app/contratos/$id"
                        params={{ id: c.contrato.id }}
                        className="hover:underline"
                      >
                        {c.contrato.numero ?? c.contrato.id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.data_prevista ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                    {c.percentual ? (
                      <span className="ml-2 text-xs text-muted-foreground">{c.percentual}%</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(c.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "a_pagar" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => marcarPaga(c.id)}>
                          <Check className="mr-1 h-4 w-4" /> Pagar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelar(c.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}
