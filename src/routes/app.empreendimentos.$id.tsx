import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Plus, Trash2, Calculator, Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/empreendimentos/$id")({
  component: EmpDetail,
});

const STATUSES = ["disponivel", "reservada", "vendida", "bloqueada"];

function EmpDetail() {
  const { id } = Route.useParams();
  const [emp, setEmp] = useState<any>(null);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [nova, setNova] = useState({ bloco: "", numero: "", andar: "", area: "", preco: "" });
  const [simUnit, setSimUnit] = useState<any>(null);
  const [sim, setSim] = useState({ entrada: 20, prazoMeses: 360, juroAnual: 11 });
  const [liveSync, setLiveSync] = useState(false);

  async function load() {
    const { data: e } = await (supabase as any).from("empreendimentos").select("*").eq("id", id).maybeSingle();
    setEmp(e);
    const { data: u } = await (supabase as any).from("empreendimento_unidades").select("*").eq("empreendimento_id", id).order("bloco").order("numero");
    setUnidades(u ?? []);
    const { data: r } = await (supabase as any).from("empreendimento_reservas").select("*,lead:leads(nome)").eq("tenant_id", e?.tenant_id ?? "").in("unidade_id", (u ?? []).map((x: any) => x.id));
    setReservas(r ?? []);
  }
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!emp?.tenant_id) return;
    const ch = supabase
      .channel(`emp_${id}_${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "empreendimento_unidades", filter: `empreendimento_id=eq.${id}` }, () => { setLiveSync(true); load(); setTimeout(() => setLiveSync(false), 800); })
      .on("postgres_changes", { event: "*", schema: "public", table: "empreendimento_reservas" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [emp?.tenant_id, id]);

  async function patchEmp(p: any) {
    await (supabase as any).from("empreendimentos").update(p).eq("id", id);
    load();
  }

  async function addUnidade() {
    if (!emp || !nova.numero.trim()) return;
    const { error } = await (supabase as any).from("empreendimento_unidades").insert({
      tenant_id: emp.tenant_id, empreendimento_id: id,
      bloco: nova.bloco || null, numero: nova.numero,
      andar: nova.andar ? Number(nova.andar) : null,
      area: nova.area ? Number(nova.area) : null,
      preco: nova.preco ? Number(nova.preco) : null,
    });
    if (error) return toast.error(error.message);
    setNova({ bloco: "", numero: "", andar: "", area: "", preco: "" });
    load();
  }

  async function patchUn(uid: string, p: any) {
    await (supabase as any).from("empreendimento_unidades").update(p).eq("id", uid);
    load();
  }

  async function delUn(uid: string) {
    await (supabase as any).from("empreendimento_unidades").delete().eq("id", uid);
    load();
  }

  function calcSAC(valor: number, entradaPct: number, prazoMeses: number, juroAnual: number) {
    const principal = valor * (1 - entradaPct / 100);
    const i = Math.pow(1 + juroAnual / 100, 1 / 12) - 1;
    const amort = principal / prazoMeses;
    const primeira = amort + principal * i;
    const ultima = amort + amort * i;
    const total = (primeira + ultima) / 2 * prazoMeses;
    return { principal, entrada: valor - principal, primeira, ultima, total };
  }

  if (!emp) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <Button variant="ghost" size="sm" asChild><Link to="/app/empreendimentos"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link></Button>

      <section className="rounded-xl border bg-card p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs">Nome</label><Input defaultValue={emp.nome} onBlur={(e) => patchEmp({ nome: e.target.value })} /></div>
          <div><label className="text-xs">Construtora</label><Input defaultValue={emp.construtora ?? ""} onBlur={(e) => patchEmp({ construtora: e.target.value || null })} /></div>
          <div><label className="text-xs">Fase</label>
            <select className="w-full rounded border bg-background px-2 py-1.5 text-sm" defaultValue={emp.fase} onChange={(e) => patchEmp({ fase: e.target.value })}>
              <option value="lancamento">Lançamento</option>
              <option value="obras">Em obras</option>
              <option value="pronto">Pronto</option>
            </select>
          </div>
          <div><label className="text-xs">Entrega prevista</label><Input type="date" defaultValue={emp.entrega_prevista ?? ""} onBlur={(e) => patchEmp({ entrega_prevista: e.target.value || null })} /></div>
          <div className="sm:col-span-2"><label className="text-xs">Descrição</label><Textarea rows={3} defaultValue={emp.descricao ?? ""} onBlur={(e) => patchEmp({ descricao: e.target.value || null })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked={emp.publicado} onChange={(e) => patchEmp({ publicado: e.target.checked })} /> Publicar no site</label>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          Espelho de unidades
          {liveSync && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"><Radio className="h-3 w-3 animate-pulse" /> ao vivo</span>}
        </h2>
        <div className="grid grid-cols-[80px,80px,80px,80px,1fr,auto] gap-2">
          <Input placeholder="Bloco" value={nova.bloco} onChange={(e) => setNova({ ...nova, bloco: e.target.value })} />
          <Input placeholder="Nº" value={nova.numero} onChange={(e) => setNova({ ...nova, numero: e.target.value })} />
          <Input placeholder="Andar" type="number" value={nova.andar} onChange={(e) => setNova({ ...nova, andar: e.target.value })} />
          <Input placeholder="Área" type="number" value={nova.area} onChange={(e) => setNova({ ...nova, area: e.target.value })} />
          <Input placeholder="Preço" type="number" value={nova.preco} onChange={(e) => setNova({ ...nova, preco: e.target.value })} />
          <Button onClick={addUnidade}><Plus className="h-4 w-4" /></Button>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left">Bloco</th><th className="text-left">Nº</th><th>Andar</th><th>Área</th><th>Preço</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {unidades.map((u) => (
              <tr key={u.id} className="border-t">
                <td>{u.bloco ?? "—"}</td>
                <td>{u.numero}</td>
                <td className="text-center">{u.andar ?? "—"}</td>
                <td className="text-center">{u.area ?? "—"}</td>
                <td className="text-center">R$ {Number(u.preco ?? 0).toLocaleString("pt-BR")}</td>
                <td className="text-center">
                  <select className="rounded border bg-background px-1 py-0.5 text-xs" defaultValue={u.status} onChange={(e) => patchUn(u.id, { status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setSimUnit(u)} title="Simular financiamento"><Calculator className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => delUn(u.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {unidades.length === 0 && <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">Sem unidades cadastradas.</td></tr>}
          </tbody>
        </table>
      </section>

      {simUnit && (
        <section className="rounded-xl border bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Simulador SAC — unidade {simUnit.bloco ? simUnit.bloco + "/" : ""}{simUnit.numero}</h2>
            <Button size="sm" variant="ghost" onClick={() => setSimUnit(null)}>Fechar</Button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div><label className="text-xs">Entrada (%)</label><Input type="number" value={sim.entrada} onChange={(e) => setSim({ ...sim, entrada: Number(e.target.value) })} /></div>
            <div><label className="text-xs">Prazo (meses)</label><Input type="number" value={sim.prazoMeses} onChange={(e) => setSim({ ...sim, prazoMeses: Number(e.target.value) })} /></div>
            <div><label className="text-xs">Juros a.a. (%)</label><Input type="number" value={sim.juroAnual} onChange={(e) => setSim({ ...sim, juroAnual: Number(e.target.value) })} /></div>
          </div>
          {(() => {
            const r = calcSAC(Number(simUnit.preco ?? 0), sim.entrada, sim.prazoMeses, sim.juroAnual);
            const fmt = (n: number) => "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
                <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Entrada</div><div className="font-semibold">{fmt(r.entrada)}</div></div>
                <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Financiado</div><div className="font-semibold">{fmt(r.principal)}</div></div>
                <div className="rounded border p-3"><div className="text-xs text-muted-foreground">1ª parcela</div><div className="font-semibold">{fmt(r.primeira)}</div></div>
                <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Última parcela</div><div className="font-semibold">{fmt(r.ultima)}</div></div>
                <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Total pago</div><div className="font-semibold">{fmt(r.total + r.entrada)}</div></div>
              </div>
            );
          })()}
        </section>
      )}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">Reservas ativas</h2>
        {reservas.length === 0 ? <p className="text-sm text-muted-foreground">Sem reservas.</p> : (
          <ul className="space-y-1 text-sm">
            {reservas.map((r) => (
              <li key={r.id} className="rounded border px-3 py-2">
                Unidade {r.unidade_id.slice(0, 8)} · {r.lead?.nome ?? "—"} · válida até {new Date(r.validade).toLocaleString("pt-BR")} · {r.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}