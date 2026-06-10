import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { X, MapPin } from "lucide-react";

type Search = { ids?: string };

export const Route = createFileRoute("/comparar")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    ids: typeof raw.ids === "string" ? raw.ids : "",
  }),
  head: () => ({ meta: [{ title: "Comparar imóveis — imob365" }] }),
  component: CompararPage,
});

function CompararPage() {
  const sp = Route.useSearch();
  const navigate = useNavigate();
  const ids = useMemo(
    () =>
      (sp.ids || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 4),
    [sp.ids],
  );
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("imoveis")
        .select(
          "id,slug,titulo,finalidade,tipo,preco,condominio,iptu,quartos,suites,banheiros,vagas,area_util,area_total,endereco_cidade,endereco_uf,endereco_bairro,caracteristicas,aceita_financiamento,aceita_permuta,imovel_fotos(storage_path,capa,ordem)",
        )
        .in("id", ids)
        .eq("publicado", true)
        .eq("status", "ativo");
      // preserve order from query string
      const order = new Map<string, number>(ids.map((id: string, i: number) => [id, i]));
      const mapped = (data ?? [])
        .map((d: any) => {
          const fotos = (d.imovel_fotos ?? [])
            .slice()
            .sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
          return { ...d, capa: fotos[0]?.storage_path ?? null };
        })
        .sort(
          (a: any, b: any) =>
            ((order.get(a.id) ?? 0) as number) - ((order.get(b.id) ?? 0) as number),
        );
      setItems(mapped);
      setLoading(false);
    })();
  }, [ids.join(",")]);

  function publicUrl(path: string | null) {
    if (!path) return null;
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
  }

  function remove(id: string) {
    const next = ids.filter((x: string) => x !== id).join(",");
    navigate({ to: "/comparar", search: { ids: next } });
  }

  const linhas: { label: string; render: (i: any) => React.ReactNode }[] = [
    {
      label: "Preço",
      render: (i) => <span className="font-semibold text-primary">{formatBRL(i.preco)}</span>,
    },
    { label: "Condomínio", render: (i) => (i.condominio ? formatBRL(i.condominio) : "—") },
    { label: "IPTU", render: (i) => (i.iptu ? formatBRL(i.iptu) : "—") },
    { label: "Finalidade", render: (i) => FINALIDADE_LABEL[i.finalidade] },
    { label: "Tipo", render: (i) => TIPO_LABEL[i.tipo] },
    { label: "Área útil", render: (i) => (i.area_util ? `${i.area_util} m²` : "—") },
    { label: "Área total", render: (i) => (i.area_total ? `${i.area_total} m²` : "—") },
    { label: "Quartos", render: (i) => i.quartos ?? "—" },
    { label: "Suítes", render: (i) => i.suites ?? "—" },
    { label: "Banheiros", render: (i) => i.banheiros ?? "—" },
    { label: "Vagas", render: (i) => i.vagas ?? "—" },
    { label: "Financiamento", render: (i) => (i.aceita_financiamento ? "Sim" : "Não") },
    { label: "Permuta", render: (i) => (i.aceita_permuta ? "Sim" : "Não") },
    {
      label: "Características",
      render: (i) =>
        i.caracteristicas?.length ? (
          <div className="flex flex-wrap gap-1">
            {i.caracteristicas.slice(0, 8).map((c: string) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                {c}
              </span>
            ))}
          </div>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Comparar imóveis</h1>
        <p className="mt-2 text-sm text-muted-foreground">Compare até 4 imóveis lado a lado.</p>

        <div className="mt-8">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum imóvel selecionado. Vá em buscar e marque a opção "Comparar".
              </p>
              <Link to="/buscar">
                <Button className="mt-4">Buscar imóveis</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 bg-background p-3 text-left text-xs font-medium text-muted-foreground"
                      style={{ width: 160 }}
                    ></th>
                    {items.map((i: any) => (
                      <th key={i.id} className="p-3 align-top">
                        <div className="relative overflow-hidden rounded-lg border border-border bg-card">
                          <button
                            type="button"
                            onClick={() => remove(i.id)}
                            aria-label="Remover"
                            className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 backdrop-blur hover:bg-background"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <Link to="/imovel/$slug" params={{ slug: i.slug }}>
                            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                              {i.capa ? (
                                <img
                                  src={publicUrl(i.capa)!}
                                  alt={i.titulo}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                  Sem foto
                                </div>
                              )}
                            </div>
                            <div className="p-3 text-left">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                                {i.titulo}
                              </h3>
                              {(i.endereco_cidade || i.endereco_bairro) && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {[
                                    i.endereco_bairro,
                                    i.endereco_cidade &&
                                      `${i.endereco_cidade}/${i.endereco_uf ?? ""}`,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.label} className="border-t border-border">
                      <td className="sticky left-0 bg-background p-3 align-top text-xs font-medium text-muted-foreground">
                        {l.label}
                      </td>
                      {items.map((i: any) => (
                        <td key={i.id} className="border-l border-border p-3 align-top text-sm">
                          {l.render(i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
