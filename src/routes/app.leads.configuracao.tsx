import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/configuracao")({
  component: LeadsConfig,
});

function LeadsConfig() {
  const { tenantId } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string; ativo: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      (supabase as any).from("tenant_lead_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      (supabase as any).from("corretores").select("id,nome,ativo").eq("tenant_id", tenantId).order("nome"),
    ]);
    setEnabled(s?.round_robin_enabled ?? true);
    setLast(s?.last_assigned_corretor_id ?? null);
    setCorretores(c ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function save() {
    if (!tenantId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("tenant_lead_settings").upsert({
      tenant_id: tenantId, round_robin_enabled: enabled,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const ativos = corretores.filter((c) => c.ativo);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/app/leads"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link>
      </Button>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Distribuição de leads</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Leads recebidos pelo site são distribuídos automaticamente entre os corretores ativos da imobiliária.
      </p>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Distribuição automática (round-robin)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando ativado, cada novo lead é atribuído ao próximo corretor da fila.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Fila atual ({ativos.length} {ativos.length === 1 ? "corretor ativo" : "corretores ativos"})</h2>
        {ativos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum corretor ativo. <Link to="/app/corretores" className="text-primary hover:underline">Cadastrar corretores</Link>
          </p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {ativos.map((c) => (
              <li key={c.id} className={`flex items-center justify-between rounded-md border border-border px-3 py-2 ${last === c.id ? "bg-primary/5" : ""}`}>
                <span>{c.nome}</span>
                {last === c.id && <span className="text-xs text-primary">último a receber</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}