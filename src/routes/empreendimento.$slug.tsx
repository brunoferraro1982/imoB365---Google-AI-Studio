import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building,
  MapPin,
  Calendar,
  Landmark,
  Maximize2,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/empreendimento/$slug")({
  component: EmpreendimentoDetail,
});

type Unidade = {
  id: string;
  bloco: string | null;
  numero: string;
  andar: number | null;
  area: number | null;
  preco: number | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  reservada: "Reservada",
  vendida: "Vendida",
  bloqueada: "Bloqueada",
};

const STATUS_COLOR: Record<string, string> = {
  disponivel: "bg-emerald-100 text-emerald-800",
  reservada: "bg-amber-100 text-amber-800",
  vendida: "bg-red-100 text-red-800",
  bloqueada: "bg-gray-100 text-gray-600",
};

const FASE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  em_obras: "Em obras",
  pronto: "Pronto",
  pre_lancamento: "Pré-lançamento",
};

function EmpreendimentoDetail() {
  const { slug } = Route.useParams();
  const [emp, setEmp] = useState<any>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("empreendimentos")
          .select("*")
          .eq("slug", slug)
          .eq("publicado", true)
          .maybeSingle();
        if (!data) {
          setLoading(false);
          return;
        }
        setEmp(data);

        const { data: us } = await (supabase as any)
          .from("empreendimento_unidades")
          .select("id,bloco,numero,andar,area,preco,status")
          .eq("empreendimento_id", data.id)
          .order("bloco")
          .order("numero");
        setUnidades((us as Unidade[]) ?? []);
      } catch {
        // handled by loading/not-found state
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
        <SiteFooter />
      </div>
    );

  if (!emp)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-16 text-center">
          <Landmark className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h1 className="text-2xl font-bold">Empreendimento não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este empreendimento pode não estar publicado ou o endereço está incorreto.
          </p>
          <Link to="/empreendimentos" className="mt-4 text-primary hover:underline">
            Ver todos os empreendimentos
          </Link>
        </div>
        <SiteFooter />
      </div>
    );

  const endereco = [
    emp.endereco_logradouro,
    emp.endereco_numero ? `nº ${emp.endereco_numero}` : null,
    emp.endereco_bairro,
    [emp.endereco_cidade, emp.endereco_uf].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(", ");

  const disponiveis = unidades.filter((u) => u.status === "disponivel");
  const menorPreco = disponiveis.length
    ? Math.min(...disponiveis.filter((u) => u.preco).map((u) => u.preco!))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/empreendimentos"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para empreendimentos
        </Link>

        {/* GALERIA */}
        {emp.fotos_urls?.length > 0 && (
          <div className="mb-8 grid gap-2 overflow-hidden rounded-xl md:grid-cols-3">
            {emp.fotos_urls.slice(0, 6).map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`${emp.nome} foto ${i + 1}`}
                className={`w-full object-cover ${i === 0 ? "md:col-span-2 md:row-span-2 aspect-[16/9] md:aspect-auto md:h-full" : "aspect-[16/9]"}`}
              />
            ))}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* CONTEÚDO PRINCIPAL */}
          <div>
            <div className="mb-2">
              <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {FASE_LABEL[emp.fase] ?? emp.fase}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{emp.nome}</h1>
            {emp.construtora && (
              <p className="mt-1 text-sm text-muted-foreground">por {emp.construtora}</p>
            )}

            {endereco && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {endereco}
              </p>
            )}

            {emp.descricao && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold">Sobre o empreendimento</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {emp.descricao}
                </p>
              </div>
            )}

            {/* ESPELHO DE UNIDADES */}
            {unidades.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold">
                  Unidades ({disponiveis.length} disponíveis de {unidades.length})
                </h2>
                <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Bloco</th>
                        <th className="px-3 py-2 text-left">Nº</th>
                        <th className="px-3 py-2 text-center">Andar</th>
                        <th className="px-3 py-2 text-center">Área</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map((u) => (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-3 py-2">{u.bloco ?? "—"}</td>
                          <td className="px-3 py-2 font-medium">{u.numero}</td>
                          <td className="px-3 py-2 text-center">{u.andar ?? "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {u.area != null ? `${u.area} m²` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {u.preco != null ? formatBRL(u.preco) : "Sob consulta"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[u.status] ?? "bg-gray-100 text-gray-600"}`}
                            >
                              {STATUS_LABEL[u.status] ?? u.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-muted-foreground">Resumo</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {menorPreco != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">A partir de</dt>
                    <dd className="text-xl font-bold text-primary">{formatBRL(menorPreco)}</dd>
                  </div>
                )}
                {emp.unidades_total != null && (
                  <div className="flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{emp.unidades_total} unidades no total</span>
                  </div>
                )}
                {emp.entrega_prevista && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Entrega:{" "}
                      {new Date(emp.entrega_prevista).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {emp.cnpj_construtora && (
                  <div className="text-xs text-muted-foreground">
                    CNPJ: {emp.cnpj_construtora}
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Interessado?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Entre em contato para mais informações sobre este empreendimento.
              </p>
              <a
                href="https://wa.me/5513997794382"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition"
              >
                Falar no WhatsApp
              </a>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
