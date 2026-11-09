import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";

type Vinculo = { id: string; template_id: string; nome: string };
type Modelo = { id: string; nome: string; tipo: string };

const SELECT =
  "h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Modelos de contrato vinculados: geram o documento com os dados atuais. */
export function ModelosVinculados({
  contratoId,
  tipoContrato,
}: {
  contratoId: string;
  tipoContrato: string;
}) {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [disponiveis, setDisponiveis] = useState<Modelo[]>([]);
  const [escolhido, setEscolhido] = useState("");

  async function carregar() {
    const [{ data: v, error: e1 }, { data: m, error: e2 }] = await Promise.all([
      supabase
        .from("contrato_modelos")
        .select("id,template_id,contrato_templates(nome)")
        .eq("contrato_id", contratoId)
        .order("created_at"),
      supabase.from("contrato_templates").select("id,nome,tipo").eq("ativo", true).order("nome"),
    ]);
    if (e1 || e2) toast.error("Não foi possível carregar os modelos: " + (e1 ?? e2)?.message);
    setVinculos(
      (
        (v ?? []) as unknown as {
          id: string;
          template_id: string;
          contrato_templates: { nome: string } | null;
        }[]
      ).map((x) => ({
        id: x.id,
        template_id: x.template_id,
        nome: x.contrato_templates?.nome ?? "Modelo",
      })),
    );
    setDisponiveis((m as Modelo[]) ?? []);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  const naoVinculados = disponiveis.filter((m) => !vinculos.some((v) => v.template_id === m.id));

  async function vincular() {
    if (!escolhido || !tenantId) return;
    const { error } = await supabase
      .from("contrato_modelos")
      .insert({ tenant_id: tenantId, contrato_id: contratoId, template_id: escolhido });
    if (error) return toast.error("Não foi possível vincular: " + error.message);
    setEscolhido("");
    carregar();
  }

  async function desvincular(v: Vinculo) {
    if (
      !(await confirmDialog(
        `Remover "${v.nome}" deste contrato? O documento deixa de ser gerado a partir dele.`,
      ))
    )
      return;
    const { error } = await supabase.from("contrato_modelos").delete().eq("id", v.id);
    if (error) return toast.error("Não foi possível remover: " + error.message);
    carregar();
  }

  return (
    <section className="glass-fosco space-y-4 rounded-3xl border border-white/40 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <FileText className="h-4 w-4 text-primary" /> Documentos do contrato
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Os modelos são gerados com os dados atuais do contrato, do cliente e do imóvel.
        </p>
      </div>

      {vinculos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhum modelo vinculado a este contrato.
        </p>
      ) : (
        <ul className="space-y-2">
          {vinculos.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3 dark:bg-white/5"
            >
              <span className="min-w-0 truncate font-semibold">{v.nome}</span>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/app/contratos/${contratoId}/imprimir?modelo=${v.template_id}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Gerar documento
                </a>
                <button
                  type="button"
                  onClick={() => desvincular(v)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remover ${v.nome}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {naoVinculados.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className={SELECT}
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
          >
            <option value="">Adicionar modelo…</option>
            {naoVinculados.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.tipo === tipoContrato ? " (mesmo tipo)" : ""}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={vincular} disabled={!escolhido}>
            <Plus className="mr-1 h-4 w-4" /> Vincular
          </Button>
        </div>
      )}
      <ConfirmDialog />
    </section>
  );
}
