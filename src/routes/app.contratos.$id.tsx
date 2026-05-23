import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, Banknote } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ContratoForm } from "@/components/contratos/ContratoForm";
import { PartesSection } from "@/components/contratos/PartesSection";
import { ContratoChecklist } from "@/components/contratos/ContratoChecklist";

export const Route = createFileRoute("/app/contratos/$id")({
  component: EditarContrato,
});

function EditarContrato() {
  const { id } = Route.useParams();
  const { tenantId, user } = useAuth();
  const [gerando, setGerando] = useState(false);

  async function gerarComissao() {
    if (!tenantId) return;
    setGerando(true);
    const { data: c, error } = await supabase
      .from("contratos")
      .select("id,valor,comissao_valor,comissao_percentual,corretor_id,imovel_id,numero")
      .eq("id", id)
      .maybeSingle();
    if (error || !c) { setGerando(false); return toast.error(error?.message ?? "Contrato não encontrado"); }
    const valor = c.comissao_valor ?? (c.comissao_percentual ? Number(c.valor) * Number(c.comissao_percentual) / 100 : 0);
    if (!valor || valor <= 0) { setGerando(false); return toast.error("Defina comissão (% ou R$) antes de gerar"); }
    const { error: insErr } = await supabase.from("lancamentos_financeiros").insert({
      tenant_id: tenantId,
      tipo: "saida" as any,
      categoria: "comissao",
      descricao: `Comissão do contrato ${c.numero ?? `#${c.id.slice(0, 8)}`}`,
      valor,
      data_vencimento: new Date().toISOString().slice(0, 10),
      status: "pendente" as any,
      contrato_id: c.id,
      imovel_id: c.imovel_id,
      corretor_id: c.corretor_id,
      created_by: user?.id,
    });
    setGerando(false);
    if (insErr) return toast.error(insErr.message);
    toast.success("Lançamento de comissão criado");
  }

  return (
    <div className="p-8">
      <Link to="/app/contratos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Editar contrato</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={gerarComissao} disabled={gerando}>
            <Banknote className="mr-2 h-4 w-4" /> {gerando ? "Gerando…" : "Gerar comissão"}
          </Button>
          <Link to="/app/contratos/$id/imprimir" params={{ id }}>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </Link>
        </div>
      </header>
      <div className="max-w-4xl space-y-6">
        <ContratoForm contratoId={id} />
        <PartesSection contratoId={id} />
        {tenantId && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Checklist de documentos</h2>
            <ContratoChecklist contratoId={id} tenantId={tenantId} />
          </section>
        )}
      </div>
    </div>
  );
}