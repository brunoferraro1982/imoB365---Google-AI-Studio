import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/flags")({
  component: FlagsPage,
});

const FLAGS = [
  { key: "ai_descricao", label: "IA — descrição automática de imóvel" },
  { key: "ai_sdr", label: "IA SDR no chat (beta)" },
  { key: "feed_social", label: "Feed social interno (beta)" },
  { key: "vistoria_digital", label: "Vistoria digital" },
  { key: "empreendimentos_espelho", label: "Empreendimentos — espelho de vendas tempo real" },
  { key: "calculadoras_publicas", label: "Calculadoras públicas no site" },
  { key: "encurtador_links", label: "Encurtador de links / QR" },
];

type Tenant = { id: string; nome: string; slug: string };

function FlagsPage() {
  const { isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tenants").select("id, nome, slug").order("nome");
      setTenants((data as Tenant[]) ?? []);
      if (data?.[0]) setTenantId(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("tenant_feature_flags")
        .select("flag_key, enabled")
        .eq("tenant_id", tenantId);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => {
        map[r.flag_key] = r.enabled;
      });
      setFlags(map);
      setLoading(false);
    })();
  }, [tenantId]);

  async function toggle(key: string, enabled: boolean) {
    setFlags((s) => ({ ...s, [key]: enabled }));
    const { error } = await (supabase as any)
      .from("tenant_feature_flags")
      .upsert(
        { tenant_id: tenantId, flag_key: key, enabled },
        { onConflict: "tenant_id,flag_key" },
      );
    if (error) toast.error(error.message);
  }

  if (!isSuperAdmin)
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito.</div>;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Feature flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ative ou desative funcionalidades por imobiliária (rollout gradual).
        </p>
      </header>

      <div className="mb-4 max-w-sm">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Imobiliária
        </label>
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-2">
          {FLAGS.map((f) => (
            <div
              key={f.key}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Flag className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.key}</div>
                </div>
              </div>
              <Switch checked={!!flags[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
