import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/configuracoes/golive")({
  component: GoLivePage,
});

type Check = { id: string; label: string; done: boolean; link?: string; hint?: string };

function GoLivePage() {
  const { tenantId } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [t, sset, imv, cor, dom, pages, site] = await Promise.all([
        supabase.from("tenants").select("nome,cnpj,creci_juridico,plano_slug").eq("id", tenantId).maybeSingle(),
        supabase.from("tenant_site_settings").select("publicado,hero_titulo,contato_email").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("imoveis").select("id", { count: "exact", head: true }).eq("publicado", true).limit(1),
        supabase.from("corretores").select("id", { count: "exact", head: true }).eq("ativo", true).limit(1),
        supabase.from("tenant_domains").select("id", { count: "exact", head: true }).eq("verificado", true).limit(1),
        supabase.from("tenant_pages").select("id", { count: "exact", head: true }).eq("publicada", true).limit(1),
        supabase.from("tenant_site_settings").select("publicado").eq("tenant_id", tenantId).maybeSingle(),
      ]);

      const tenant: any = t.data ?? {};
      const ss: any = sset.data ?? {};
      const list: Check[] = [
        { id: "tenant", label: "Dados da imobiliária preenchidos (CNPJ + CRECI)",
          done: !!(tenant.cnpj && tenant.creci_juridico),
          link: "/app/configuracoes/imobiliaria" },
        { id: "plano", label: "Plano selecionado", done: !!tenant.plano_slug,
          link: "/app/configuracoes/imobiliaria" },
        { id: "site", label: "Site público configurado e publicado",
          done: !!(ss.publicado && ss.hero_titulo && ss.contato_email),
          link: "/app/site" },
        { id: "imoveis", label: "Pelo menos 1 imóvel publicado",
          done: (imv.count ?? 0) > 0, link: "/app/imoveis" },
        { id: "corretores", label: "Pelo menos 1 corretor ativo",
          done: (cor.count ?? 0) > 0, link: "/app/corretores" },
        { id: "pages", label: "Páginas institucionais publicadas (opcional)",
          done: (pages.count ?? 0) > 0, link: "/app/site" },
        { id: "dominio", label: "Domínio próprio verificado (opcional)",
          done: (dom.count ?? 0) > 0, link: "/app/configuracoes/dominios" },
      ];
      setChecks(list);
      setLoading(false);
    })();
  }, [tenantId]);

  const total = checks.length;
  const done = checks.filter((c) => c.done).length;
  const required = checks.filter((c) => !c.label.includes("opcional"));
  const requiredDone = required.filter((c) => c.done).length;
  const ready = requiredDone === required.length && required.length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Checklist Go-live</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Conclua os passos abaixo antes de divulgar seu site ao público.
        </p>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all"
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%" }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{done} de {total} concluídos</div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {c.done
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <Circle className="h-5 w-5 text-muted-foreground/50" />}
                <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </div>
              {c.link && (
                <Link to={c.link} className="text-xs text-primary hover:underline">
                  {c.done ? "Revisar" : "Configurar"} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {ready && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 p-6 text-center dark:bg-emerald-950/30">
          <Rocket className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Pronto para o go-live!
          </p>
        </div>
      )}
    </div>
  );
}