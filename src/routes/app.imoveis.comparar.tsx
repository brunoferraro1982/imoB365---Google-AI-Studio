import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, X, Check, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { z } from "zod";

const search = z.object({ ids: z.string().optional() });

export const Route = createFileRoute("/app/imoveis/comparar")({
  validateSearch: (s) => search.parse(s),
  component: CompararPage,
});

type Imovel = any;

function CompararPage() {
  const { tenantId } = useAuth();
  const { ids } = useSearch({ from: "/app/imoveis/comparar" });
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<
    { id: string; titulo: string; codigo_interno: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const selectedIds = (ids ?? "").split(",").filter(Boolean).slice(0, 4);

  function setIds(novos: string[]) {
    const newIds = Array.from(new Set(novos)).slice(0, 4).join(",");
    const url = newIds ? `/app/imoveis/comparar?ids=${newIds}` : `/app/imoveis/comparar`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (selectedIds.length > 0) {
        const { data } = await supabase
          .from("imoveis")
          .select("*")
          .in("id", selectedIds)
          .eq("tenant_id", tenantId ?? "");
        setImoveis(data ?? []);
      } else {
        setImoveis([]);
      }
      setLoading(false);
    })();
  }, [ids]);

  useEffect(() => {
    (async () => {
      const q = supabase
        .from("imoveis")
        .select("id,titulo,codigo_interno")
        .eq("tenant_id", tenantId ?? "")
        .order("updated_at", { ascending: false })
        .limit(20);
      const { data } = busca.trim() ? await q.ilike("titulo", `%${busca.trim()}%`) : await q;
      setOpcoes(data ?? []);
    })();
  }, [busca]);

  function add(id: string) {
    setIds([...selectedIds, id]);
  }
  function remove(id: string) {
    setIds(selectedIds.filter((i: string) => i !== id));
  }

  const rows: { label: string; get: (i: Imovel) => any; fmt?: (v: any) => string }[] = [
    { label: "Preço", get: (i) => i.preco, fmt: (v) => formatBRL(v) },
    { label: "Condomínio", get: (i) => i.condominio, fmt: (v) => (v ? formatBRL(v) : "—") },
    { label: "IPTU", get: (i) => i.iptu, fmt: (v) => (v ? formatBRL(v) : "—") },
    { label: "Tipo", get: (i) => TIPO_LABEL[i.tipo] ?? i.tipo },
    { label: "Finalidade", get: (i) => FINALIDADE_LABEL[i.finalidade] ?? i.finalidade },
    { label: "Área útil", get: (i) => i.area_util, fmt: (v) => (v ? `${v} m²` : "—") },
    { label: "Área total", get: (i) => i.area_total, fmt: (v) => (v ? `${v} m²` : "—") },
    { label: "Quartos", get: (i) => i.quartos ?? "—" },
    { label: "Suítes", get: (i) => i.suites ?? "—" },
    { label: "Banheiros", get: (i) => i.banheiros ?? "—" },
    { label: "Vagas", get: (i) => i.vagas ?? "—" },
    {
      label: "Cidade",
      get: (i) => (i.endereco_cidade ? `${i.endereco_cidade}/${i.endereco_uf ?? ""}` : "—"),
    },
    { label: "Bairro", get: (i) => i.endereco_bairro ?? "—" },
    { label: "Aceita permuta", get: (i) => i.aceita_permuta, fmt: (v) => (v ? "Sim" : "Não") },
    {
      label: "Aceita financiamento",
      get: (i) => i.aceita_financiamento,
      fmt: (v) => (v ? "Sim" : "Não"),
    },
  ];

  // Selos automáticos
  function badgesFor(im: Imovel) {
    const tags: string[] = [];
    const precos = imoveis.map((x) => Number(x.preco)).filter(Boolean);
    if (precos.length > 1 && Number(im.preco) === Math.min(...precos)) tags.push("Melhor preço");
    const areas = imoveis.map((x) => Number(x.area_util)).filter(Boolean);
    if (areas.length > 1 && Number(im.area_util) === Math.max(...areas)) tags.push("Maior área");
    const quartos = imoveis.map((x) => Number(x.quartos)).filter(Boolean);
    if (quartos.length > 1 && Number(im.quartos) === Math.max(...quartos))
      tags.push("Mais quartos");
    return tags;
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/imoveis">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para imóveis
          </Link>
        </Button>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">Comparador de imóveis</h1>
      <p className="mt-1 text-sm text-muted-foreground">Compare até 4 imóveis lado a lado.</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar imóvel para adicionar…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-md"
          />
          <span className="text-xs text-muted-foreground">{selectedIds.length}/4 selecionados</span>
        </div>
        {busca.trim() && (
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border text-sm">
            {opcoes.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between border-b px-3 py-2 last:border-0"
              >
                <span>
                  {o.titulo}{" "}
                  {o.codigo_interno && (
                    <span className="text-xs text-muted-foreground">#{o.codigo_interno}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedIds.includes(o.id) || selectedIds.length >= 4}
                  onClick={() => add(o.id)}
                >
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : imoveis.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Selecione imóveis acima para começar a comparação.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">
                  Característica
                </th>
                {imoveis.map((im) => (
                  <th key={im.id} className="px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{im.titulo}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {badgesFor(im).map((b) => (
                            <Badge key={b} className="bg-emerald-600 text-[10px]">
                              {b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => remove(im.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="px-4 py-2 text-xs uppercase text-muted-foreground">{r.label}</td>
                  {imoveis.map((im) => {
                    const v = r.get(im);
                    const str = r.fmt ? r.fmt(v) : (v ?? "—");
                    return (
                      <td key={im.id} className="px-4 py-2">
                        {str}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t">
                <td className="px-4 py-2 text-xs uppercase text-muted-foreground">
                  Características
                </td>
                {imoveis.map((im) => {
                  const all = Array.from(new Set(imoveis.flatMap((x) => x.caracteristicas ?? [])));
                  return (
                    <td key={im.id} className="px-4 py-2">
                      <ul className="space-y-1 text-xs">
                        {all.map((c) => (
                          <li key={c} className="flex items-center gap-1">
                            {(im.caracteristicas ?? []).includes(c) ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground/50" />
                            )}
                            <span
                              className={
                                (im.caracteristicas ?? []).includes(c)
                                  ? ""
                                  : "text-muted-foreground/60"
                              }
                            >
                              {c}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
