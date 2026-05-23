import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Layers, Banknote, ShieldCheck, Mail, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Stats = {
  tenants: number;
  tenantsAtivos: number;
  modulosAtivos: number;
  receitaMes: number;
  auditoria: number;
  emails: number;
  usuarios: number;
};

function AdminOverview() {
  const [s, setS] = useState<Stats>({ tenants: 0, tenantsAtivos: 0, modulosAtivos: 0, receitaMes: 0, auditoria: 0, emails: 0, usuarios: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const inicio = new Date();
      inicio.setDate(1); inicio.setHours(0, 0, 0, 0);

      const [t, ta, tm, lf, al, em, ur] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("tenants").select("id,plano_slug", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tenant_modules").select("tenant_id", { count: "exact", head: true }).eq("enabled", true),
        supabase.from("lancamentos_financeiros").select("valor").eq("tipo", "receita").eq("status", "pago").gte("data_pagamento", inicio.toISOString().slice(0, 10)),
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", inicio.toISOString()),
        supabase.from("email_send_log").select("id", { count: "exact", head: true }).gte("created_at", inicio.toISOString()),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
      ]);

      setS({
        tenants: t.count ?? 0,
        tenantsAtivos: ta.count ?? 0,
        modulosAtivos: tm.count ?? 0,
        receitaMes: (lf.data ?? []).reduce((acc: number, r: any) => acc + Number(r.valor ?? 0), 0),
        auditoria: al.count ?? 0,
        emails: em.count ?? 0,
        usuarios: ur.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Imobiliárias", value: `${s.tenantsAtivos} / ${s.tenants}`, icon: Building2, to: "/admin/tenants" },
    { label: "Módulos ativados", value: String(s.modulosAtivos), icon: Layers, to: "/admin/modulos" },
    { label: "Receita do mês", value: formatBRL(s.receitaMes), icon: Banknote, to: "/admin/planos" },
    { label: "Eventos no mês", value: String(s.auditoria), icon: ShieldCheck, to: "/admin/auditoria" },
    { label: "E-mails no mês", value: String(s.emails), icon: Mail, to: "/admin/emails" },
    { label: "Usuários com papel", value: String(s.usuarios), icon: Users, to: "/admin/tenants" },
  ];

  return (
    <div className="p-8">
      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Super-admin
      </span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Plataforma imob365</h1>
      <p className="mt-1 text-sm text-muted-foreground">Controle global de tenants, planos, módulos e integrações.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-bold">{loading ? "—" : c.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}