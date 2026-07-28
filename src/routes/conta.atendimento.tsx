import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Headset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_VARIANT, CATEGORIA_LABEL } from "@/lib/chamadosLabels";

export const Route = createFileRoute("/conta/atendimento")({
  head: () => ({ meta: [{ title: "Meus chamados — imob365" }] }),
  component: MeusChamadosPage,
});

type MeuChamado = {
  id: string;
  numero: string;
  assunto: string;
  categoria: string;
  status: string;
  created_at: string;
};

function MeusChamadosPage() {
  const [itens, setItens] = useState<MeuChamado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // RLS (chamados_solicitante_read) já restringe aos chamados do próprio
    // usuário logado — não precisa de RPC nem filtro extra aqui.
    supabase
      .from("chamados")
      .select("id,numero,assunto,categoria,status,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItens((data ?? []) as MeuChamado[]);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Headset className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Meus chamados</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Chamados que você abriu com a imoB365 ou com uma imobiliária parceira.
      </p>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não abriu nenhum chamado.{" "}
              <a href="/atendimento" className="text-primary underline">
                Abrir um chamado agora
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.numero}</span>
                      <Badge variant="secondary">{CATEGORIA_LABEL[c.categoria]}</Badge>
                      <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.assunto}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
