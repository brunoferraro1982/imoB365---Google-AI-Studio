import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type Item = { valor_anterior: string | null; valor_novo: string | null; created_at: string };

export function HistoricoPreco({ imovelId, precoAtual }: { imovelId: string; precoAtual: number }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as any)("public_historico_preco", { _imovel_id: imovelId });
      setItems((data as Item[]) ?? []);
    })();
  }, [imovelId]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Histórico de preço</h2>
      <ul className="mt-4 divide-y divide-border">
        <li className="flex items-center justify-between py-2 text-sm">
          <span className="text-muted-foreground">Hoje</span>
          <span className="font-semibold text-foreground">{formatBRL(precoAtual)}</span>
        </li>
        {items.map((h, i) => {
          const ant = h.valor_anterior ? Number(h.valor_anterior) : null;
          const nov = h.valor_novo ? Number(h.valor_novo) : null;
          const diff = ant != null && nov != null ? nov - ant : 0;
          const Icon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
          const color = diff < 0 ? "text-emerald-600" : diff > 0 ? "text-red-600" : "text-muted-foreground";
          return (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(h.created_at).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{ant != null ? formatBRL(ant) : "—"} →</span>
                <span className="font-medium">{nov != null ? formatBRL(nov) : "—"}</span>
                <span className={`inline-flex items-center gap-0.5 ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {ant && nov ? `${(((nov - ant) / ant) * 100).toFixed(1)}%` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}