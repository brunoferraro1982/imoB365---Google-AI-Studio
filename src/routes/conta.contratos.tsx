import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { TIPO_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/lib/contratosLabels";

export const Route = createFileRoute("/conta/contratos")({
  head: () => ({ meta: [{ title: "Meus contratos — imob365" }] }),
  component: MeusContratosPage,
});

// CLM Sprint 15 — Portal do Proprietário: hoje /conta/* só atende
// comprador/locatário-cliente, nenhum proprietário (vendedor/locador)
// consegue ver o próprio contrato. Reaproveita o mesmo padrão de
// public_minhas_visitas() — RPC SECURITY DEFINER casando por e-mail (não
// existe FK real de contrato_partes pra auth.users), só leitura.
type MeuContrato = {
  id: string;
  numero: string | null;
  tipo: string;
  status: string;
  etapa_atual: string | null;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  papel: string;
  imovel_titulo: string | null;
  imovel_slug: string | null;
  tenant_nome: string | null;
};

function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function MeusContratosPage() {
  const [itens, setItens] = useState<MeuContrato[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.rpc as any)("public_meus_contratos").then(({ data, error }: any) => {
      if (!error) setItens((data ?? []) as MeuContrato[]);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <FileSignature className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Meus contratos</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Contratos de venda ou locação em que você aparece como proprietário.
      </p>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum contrato encontrado com o e-mail desta conta. Se você é proprietário de um
              imóvel anunciado, confirme com a imobiliária que este e-mail foi cadastrado no
              contrato.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.numero ? `#${c.numero}` : "Contrato"}</span>
                      <Badge variant="secondary">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.imovel_titulo ?? "Imóvel"} · {c.tenant_nome ?? "Imobiliária"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vigência: {fmtData(c.data_inicio)} a {fmtData(c.data_fim)}
                      {c.valor != null && ` · Valor: ${formatBRL(c.valor)}`}
                    </p>
                  </div>
                  {c.imovel_slug && (
                    <Link
                      to="/imovel/$slug"
                      params={{ slug: c.imovel_slug }}
                      className="text-sm text-primary hover:underline"
                    >
                      Ver imóvel
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
