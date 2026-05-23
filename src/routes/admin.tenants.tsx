import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenants,
});

type Tenant = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  plano_slug: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["trial", "active", "suspended", "cancelled"];

function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<{ slug: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("slug,nome").eq("ativo", true),
    ]);
    setTenants((t as Tenant[]) ?? []);
    setPlans(p ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateField(id: string, field: "status" | "plano_slug", value: string) {
    const payload: Record<string, unknown> = { [field]: value };
    const { error } = await supabase.from("tenants").update(payload as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Imobiliária atualizada");
    load();
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight">Imobiliárias</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gestão global de tenants da plataforma.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : tenants.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma imobiliária cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Imobiliária</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.cnpj ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Select value={t.plano_slug ?? ""} onValueChange={(v) => updateField(t.id, "plano_slug", v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={t.status} onValueChange={(v) => updateField(t.id, "status", v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}