import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/modulos")({
  component: AdminModulos,
});

type Module = {
  slug: string;
  nome: string;
  descricao: string | null;
  versao: string;
  core: boolean;
  requires_plan: string | null;
  depends_on: string[];
};

function AdminModulos() {
  const [mods, setMods] = useState<Module[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from("modules").select("*").order("nome");
      const { data: tm } = await supabase.from("tenant_modules").select("module_slug,enabled");
      const c: Record<string, number> = {};
      (tm ?? []).forEach((r: any) => {
        if (r.enabled) c[r.module_slug] = (c[r.module_slug] ?? 0) + 1;
      });
      setMods((m as Module[]) ?? []);
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Módulos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de módulos disponíveis na plataforma.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {mods.map((m) => (
          <div key={m.slug} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{m.nome}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  slug: {m.slug} · v{m.versao}
                </p>
              </div>
              {m.core ? <Badge>Core</Badge> : <Badge variant="outline">Opcional</Badge>}
            </div>
            {m.descricao && <p className="mt-2 text-sm text-muted-foreground">{m.descricao}</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Ativos em <strong className="text-foreground">{counts[m.slug] ?? 0}</strong> tenants
              </span>
              {m.depends_on?.length > 0 && <span>Depende: {m.depends_on.join(", ")}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
