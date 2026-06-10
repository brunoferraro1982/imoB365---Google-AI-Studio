import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
};

const LABEL: Record<string, string> = { preco: "Preço", status: "Status", publicado: "Publicado" };

function fmt(campo: string, valor: string | null) {
  if (valor === null) return "—";
  if (campo === "preco")
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      Number(valor),
    );
  if (campo === "publicado") return valor === "true" ? "Sim" : "Não";
  return valor;
}

export function ImovelHistorico({ imovelId }: { imovelId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("imovel_historico")
        .select("id, campo, valor_anterior, valor_novo, created_at")
        .eq("imovel_id", imovelId)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as Item[]) ?? []);
      setLoading(false);
    })();
  }, [imovelId]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando histórico…</div>;
  if (!items.length)
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        Sem alterações registradas.
      </div>
    );

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm"
        >
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <History className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{LABEL[it.campo] ?? it.campo}</div>
            <div className="text-xs text-muted-foreground">
              <span className="line-through">{fmt(it.campo, it.valor_anterior)}</span> →{" "}
              <span className="text-foreground">{fmt(it.campo, it.valor_novo)}</span>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(it.created_at).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}
