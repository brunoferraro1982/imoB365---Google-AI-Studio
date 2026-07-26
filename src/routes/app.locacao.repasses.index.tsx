import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Check, Pencil, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";
import { moduleGuard } from "@/lib/routeGuard";
import { gerarRepassesAgora } from "@/lib/locacaoRepasses.functions";

export const Route = createFileRoute("/app/locacao/repasses/")({
  beforeLoad: moduleGuard("financeiro"),
  head: () => ({ meta: [{ title: "Repasses — imob365" }] }),
  component: RepassesList,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  recebido: "Aluguel recebido",
  repassado: "Repassado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  repassado: "default",
  recebido: "secondary",
  pendente: "outline",
};

function formatMes(mesReferencia: string) {
  const [ano, mes] = mesReferencia.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function RepassesList() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const gerarAgora = useServerFn(gerarRepassesAgora);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [filter, setFilter] = useState<"todos" | "pendente" | "recebido" | "repassado">("todos");

  async function load() {
    setLoading(true);
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("locacao_repasses")
      .select(
        "id,mes_referencia,valor_aluguel,taxa_admin_valor,outros_descontos,valor_repasse,status,data_recebimento,data_repasse,contrato:contratos(id,numero,imovel:imoveis(id,titulo))",
      )
      .eq("tenant_id", tenantId)
      .order("mes_referencia", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  async function gerar() {
    setGerando(true);
    try {
      const resultado = await gerarAgora();
      toast.success(
        `${resultado.criados} repasse(s) gerado(s)${resultado.jaExistiam ? `, ${resultado.jaExistiam} já existia(m)` : ""}.`,
      );
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar os repasses");
    } finally {
      setGerando(false);
    }
  }

  async function marcarRecebido(id: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("locacao_repasses")
      .update({ status: "recebido", data_recebimento: hoje })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aluguel marcado como recebido");
    load();
  }

  async function marcarRepassado(id: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("locacao_repasses")
      .update({ status: "repassado", data_repasse: hoje })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Repasse ao proprietário confirmado");
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Apagar este repasse? Essa ação não pode ser desfeita."))) return;
    const { error } = await supabase
      .from("locacao_repasses")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId ?? "");
    if (error) return toast.error(error.message);
    toast.success("Repasse apagado");
    load();
  }

  const filtered = items.filter((r) => filter === "todos" || r.status === filter);

  const totals = useMemo(() => {
    let pendente = 0,
      aRepassar = 0,
      repassado = 0;
    for (const r of items) {
      const v = Number(r.valor_repasse) || 0;
      if (r.status === "pendente") pendente += v;
      else if (r.status === "recebido") aRepassar += v;
      else if (r.status === "repassado") repassado += v;
    }
    return { pendente, aRepassar, repassado };
  }, [items]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repasses de locação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerado automaticamente todo dia 1º pra cada contrato de locação ativo.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={gerar} disabled={gerando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
          {gerando ? "Gerando…" : "Gerar agora"}
        </Button>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat
          label="Aguardando recebimento"
          value={formatBRL(totals.pendente)}
          className="text-amber-600"
        />
        <Stat
          label="Recebido, a repassar"
          value={formatBRL(totals.aRepassar)}
          className="text-sky-600"
        />
        <Stat label="Repassado" value={formatBRL(totals.repassado)} className="text-emerald-600" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["todos", "pendente", "recebido", "repassado"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Landmark className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum repasse ainda. Clique em "Gerar agora" ou aguarde a geração automática do dia 1º.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Imóvel</th>
                <th className="px-4 py-3 text-left">Mês</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aluguel</th>
                <th className="px-4 py-3 text-right">Repasse líquido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {r.contrato?.imovel ? (
                      <Link
                        to="/app/imoveis/$id"
                        params={{ id: r.contrato.imovel.id }}
                        className="hover:underline"
                      >
                        {r.contrato.imovel.titulo}
                      </Link>
                    ) : (
                      (r.contrato?.numero ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {formatMes(r.mes_referencia)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{formatBRL(r.valor_aluguel)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(r.valor_repasse)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "pendente" && (
                      <Button variant="ghost" size="sm" onClick={() => marcarRecebido(r.id)}>
                        <Check className="mr-1 h-4 w-4" /> Recebido
                      </Button>
                    )}
                    {r.status === "recebido" && (
                      <Button variant="ghost" size="sm" onClick={() => marcarRepassado(r.id)}>
                        <Check className="mr-1 h-4 w-4" /> Repassar
                      </Button>
                    )}
                    <Link to="/app/locacao/repasses/$id" params={{ id: r.id }}>
                      <Button variant="ghost" size="sm" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" title="Apagar" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog />
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
