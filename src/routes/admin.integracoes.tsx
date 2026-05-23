import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plug, Globe2, Mail, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/integracoes")({
  component: Integracoes,
});

type Counts = { feeds: number; webhooks: number; dominios: number; emails: number };

function Integracoes() {
  const [c, setC] = useState<Counts>({ feeds: 0, webhooks: 0, dominios: 0, emails: 0 });

  useEffect(() => {
    (async () => {
      const [f, w, d, e] = await Promise.all([
        supabase.from("portal_feeds").select("id", { count: "exact", head: true }).eq("enabled", true),
        supabase.from("tenant_webhooks").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("tenant_domains").select("id", { count: "exact", head: true }).eq("verificado", true),
        supabase.from("email_send_log").select("id", { count: "exact", head: true }),
      ]);
      setC({ feeds: f.count ?? 0, webhooks: w.count ?? 0, dominios: d.count ?? 0, emails: e.count ?? 0 });
    })();
  }, []);

  const items = [
    { label: "Feeds de portais ativos", value: c.feeds, icon: Globe2, hint: "ZAP, Viva Real, OLX (XML público)" },
    { label: "Webhooks ativos", value: c.webhooks, icon: Webhook, hint: "Entregas assinadas HMAC-SHA256" },
    { label: "Domínios verificados", value: c.dominios, icon: Plug, hint: "White-label de tenants" },
    { label: "E-mails enviados (total)", value: c.emails, icon: Mail, hint: "notify.imob365.com.br" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de portais, webhooks, domínios e e-mails.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{i.label}</span>
              <i.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-bold">{i.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{i.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}