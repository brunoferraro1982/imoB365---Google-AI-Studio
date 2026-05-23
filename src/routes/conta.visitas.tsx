import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, MapPin, ExternalLink, CheckCircle2, Clock, XCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/conta/visitas")({
  head: () => ({ meta: [{ title: "Minhas visitas — imob365" }] }),
  component: VisitasPage,
});

type Visita = {
  id: string;
  data_hora: string;
  status: string;
  visitante_nome: string | null;
  observacoes: string | null;
  checkin_token: string | null;
  nps_score: number | null;
  imovel_titulo: string;
  imovel_slug: string;
  imovel_endereco: string | null;
  tenant_nome: string | null;
};

const STATUS_INFO: Record<string, { label: string; icon: any; cls: string }> = {
  agendada: { label: "Agendada", icon: Clock, cls: "text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/40" },
  confirmada: { label: "Confirmada", icon: CheckCircle2, cls: "text-blue-700 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/40" },
  realizada: { label: "Realizada", icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/40" },
  cancelada: { label: "Cancelada", icon: XCircle, cls: "text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/40" },
  nao_compareceu: { label: "Não compareceu", icon: XCircle, cls: "text-muted-foreground bg-muted" },
};

function VisitasPage() {
  const [items, setItems] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.rpc as any)("public_minhas_visitas").then(({ data, error }: any) => {
      if (!error) setItems((data ?? []) as Visita[]);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Minhas visitas</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Visitas que você solicitou pelos sites das imobiliárias.</p>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não solicitou nenhuma visita.</p>
            <Link to="/buscar"><Button className="mt-4">Buscar imóveis</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((v) => {
              const info = STATUS_INFO[v.status] ?? STATUS_INFO.agendada;
              const Icon = info.icon;
              const data = new Date(v.data_hora);
              return (
                <div key={v.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${info.cls}`}>
                          <Icon className="h-3 w-3" /> {info.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {data.toLocaleDateString("pt-BR")} · {data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <Link to="/imovel/$slug" params={{ slug: v.imovel_slug }} className="mt-2 block text-base font-semibold hover:text-primary">
                        {v.imovel_titulo}
                      </Link>
                      {v.imovel_endereco && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {v.imovel_endereco}
                        </p>
                      )}
                      {v.tenant_nome && (
                        <p className="mt-1 text-xs text-muted-foreground">por {v.tenant_nome}</p>
                      )}
                      {v.observacoes && (
                        <p className="mt-2 text-xs text-muted-foreground italic">"{v.observacoes}"</p>
                      )}
                      {v.nps_score != null && (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Você avaliou: {v.nps_score}/10
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Link to="/imovel/$slug" params={{ slug: v.imovel_slug }}>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="mr-1.5 h-4 w-4" /> Ver imóvel
                        </Button>
                      </Link>
                      {v.status === "realizada" && v.checkin_token && v.nps_score == null && (
                        <Link to="/visita-checkin/$token" params={{ token: v.checkin_token }}>
                          <Button size="sm">Avaliar visita</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}