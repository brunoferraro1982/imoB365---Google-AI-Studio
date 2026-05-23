import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Building2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Pref = {
  lead_id: string;
  tenant_id: string;
  finalidade: string | null;
  tipos: string[];
  bairros: string[];
  cidades: string[];
  preco_min: number | null;
  preco_max: number | null;
  quartos_min: number | null;
  vagas_min: number | null;
  area_min: number | null;
  observacoes: string | null;
};

function csv(arr: string[]) { return arr.join(", "); }
function parseCsv(v: string) { return v.split(",").map((s) => s.trim()).filter(Boolean); }

export function LeadPreferenciasMatch({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const [pref, setPref] = useState<Pref | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: m }] = await Promise.all([
      (supabase as any).from("lead_preferencias").select("*").eq("lead_id", leadId).maybeSingle(),
      (supabase as any)
        .from("lead_imovel_matches")
        .select("id,score,motivo,imovel:imoveis(id,titulo,slug,preco,endereco_bairro,endereco_cidade,tipo,finalidade)")
        .eq("lead_id", leadId)
        .order("score", { ascending: false })
        .limit(20),
    ]);
    setPref(p ?? {
      lead_id: leadId, tenant_id: tenantId,
      finalidade: null, tipos: [], bairros: [], cidades: [],
      preco_min: null, preco_max: null, quartos_min: null, vagas_min: null, area_min: null,
      observacoes: null,
    });
    setMatches(m ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [leadId]);

  function patch<K extends keyof Pref>(k: K, v: Pref[K]) {
    setPref((p) => (p ? { ...p, [k]: v } : p));
  }

  async function save() {
    if (!pref) return;
    setSaving(true);
    const { error } = await (supabase as any).from("lead_preferencias").upsert(pref);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferências salvas");
  }

  async function recompute() {
    setComputing(true);
    const { error } = await (supabase as any).rpc("compute_lead_matches", { _lead_id: leadId });
    setComputing(false);
    if (error) return toast.error(error.message);
    toast.success("Matches atualizados");
    load();
  }

  if (loading || !pref) return <div className="p-4 text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferências e match de imóveis</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>Salvar</Button>
          <Button size="sm" onClick={recompute} disabled={computing}>
            {computing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Recalcular matches
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs">Finalidade</label>
          <select className="w-full rounded border bg-background px-2 py-1.5 text-sm" value={pref.finalidade ?? ""} onChange={(e) => patch("finalidade", e.target.value || null)}>
            <option value="">Qualquer</option>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Tipos (separe por vírgula)</label>
          <Input value={csv(pref.tipos)} onChange={(e) => patch("tipos", parseCsv(e.target.value))} placeholder="apartamento, casa" />
        </div>
        <div>
          <label className="text-xs">Bairros</label>
          <Input value={csv(pref.bairros)} onChange={(e) => patch("bairros", parseCsv(e.target.value))} placeholder="Centro, Jardins" />
        </div>
        <div>
          <label className="text-xs">Cidades</label>
          <Input value={csv(pref.cidades)} onChange={(e) => patch("cidades", parseCsv(e.target.value))} />
        </div>
        <div>
          <label className="text-xs">Preço mín. (R$)</label>
          <Input type="number" value={pref.preco_min ?? ""} onChange={(e) => patch("preco_min", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="text-xs">Preço máx. (R$)</label>
          <Input type="number" value={pref.preco_max ?? ""} onChange={(e) => patch("preco_max", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="text-xs">Quartos mín.</label>
          <Input type="number" value={pref.quartos_min ?? ""} onChange={(e) => patch("quartos_min", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="text-xs">Vagas mín.</label>
          <Input type="number" value={pref.vagas_min ?? ""} onChange={(e) => patch("vagas_min", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs">Observações</label>
          <Textarea rows={2} value={pref.observacoes ?? ""} onChange={(e) => patch("observacoes", e.target.value || null)} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Imóveis compatíveis</h3>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum match calculado. Salve as preferências e clique em "Recalcular matches".</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <Link to="/imovel/$slug" params={{ slug: m.imovel?.slug ?? "" }} className="hover:underline">
                    {m.imovel?.titulo}
                  </Link>
                  <span className="text-xs text-muted-foreground">{m.imovel?.endereco_bairro} · R$ {Number(m.imovel?.preco ?? 0).toLocaleString("pt-BR")}</span>
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{m.score} pts</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}