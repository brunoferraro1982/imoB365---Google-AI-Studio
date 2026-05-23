import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Save, X, Infinity as InfinityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatQuota } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/planos")({
  component: AdminPlanos,
});

type Plan = {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  modulos_incluidos: string[];
  limites: Record<string, number>;
  ativo: boolean;
};

function AdminPlanos() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ nome: string; preco: string; quota: string; imoveis: string; usuarios: string }>({
    nome: "", preco: "", quota: "", imoveis: "", usuarios: "",
  });
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ slug: "", nome: "", preco: "0", quota: "3", imoveis: "50", usuarios: "3" });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("preco_mensal");
    setPlans((data as unknown as Plan[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEdit(p: Plan) {
    setEditing(p.id);
    setForm({
      nome: p.nome,
      preco: String(p.preco_mensal ?? 0),
      quota: String(p.limites?.modulos ?? 0),
      imoveis: String(p.limites?.imoveis ?? 0),
      usuarios: String(p.limites?.usuarios ?? 0),
    });
  }

  async function saveEdit(id: string) {
    const payload = {
      nome: form.nome,
      preco_mensal: Number(form.preco) || 0,
      limites: {
        modulos: Number(form.quota) || 0,
        imoveis: Number(form.imoveis) || 0,
        usuarios: Number(form.usuarios) || 0,
      },
    };
    const { error } = await supabase.from("plans").update(payload as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado");
    setEditing(null);
    load();
  }

  async function createNew(e: FormEvent) {
    e.preventDefault();
    const slug = newPlan.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug || !newPlan.nome.trim()) return toast.error("Slug e nome são obrigatórios");
    const { error } = await supabase.from("plans").insert({
      slug,
      nome: newPlan.nome.trim(),
      preco_mensal: Number(newPlan.preco) || 0,
      modulos_incluidos: ["core", "catalogo", "crm", "corretores", "admin"],
      limites: {
        modulos: Number(newPlan.quota) || 0,
        imoveis: Number(newPlan.imoveis) || 0,
        usuarios: Number(newPlan.usuarios) || 0,
      },
      ativo: true,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Plano criado");
    setCreating(false);
    setNewPlan({ slug: "", nome: "", preco: "0", quota: "3", imoveis: "50", usuarios: "3" });
    load();
  }

  async function toggleAtivo(p: Plan) {
    const { error } = await supabase.from("plans").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada plano define a <strong>cota de módulos opcionais</strong> que o tenant pode ativar.
            Os módulos core ficam inclusos em todos os planos.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> Novo plano
        </Button>
      </header>

      {creating && (
        <form onSubmit={createNew} className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-6">
          <div className="md:col-span-1">
            <Label className="text-xs">Slug</Label>
            <Input value={newPlan.slug} onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })} placeholder="enterprise" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Nome</Label>
            <Input value={newPlan.nome} onChange={(e) => setNewPlan({ ...newPlan, nome: e.target.value })} placeholder="Enterprise" />
          </div>
          <div>
            <Label className="text-xs">Preço/mês</Label>
            <Input type="number" step="0.01" value={newPlan.preco} onChange={(e) => setNewPlan({ ...newPlan, preco: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Cota módulos (-1 = ∞)</Label>
            <Input type="number" value={newPlan.quota} onChange={(e) => setNewPlan({ ...newPlan, quota: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-1">
            <div>
              <Label className="text-xs">Imóveis</Label>
              <Input type="number" value={newPlan.imoveis} onChange={(e) => setNewPlan({ ...newPlan, imoveis: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Usuários</Label>
              <Input type="number" value={newPlan.usuarios} onChange={(e) => setNewPlan({ ...newPlan, usuarios: e.target.value })} />
            </div>
          </div>
          <div className="flex items-end gap-2 md:col-span-6">
            <Button type="submit" size="sm"><Save className="mr-1 h-4 w-4" />Criar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                {editing === p.id ? (
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-8 max-w-[160px]" />
                ) : (
                  <h2 className="text-xl font-semibold">{p.nome}</h2>
                )}
                <Badge
                  variant={p.ativo ? "default" : "secondary"}
                  onClick={() => toggleAtivo(p)}
                  className="cursor-pointer"
                >
                  {p.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">slug: <span className="font-mono">{p.slug}</span></p>

              {editing === p.id ? (
                <div className="mt-4 space-y-3">
                  <Field label="Preço/mês (R$)">
                    <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
                  </Field>
                  <Field label="Cota de módulos (-1 = ilimitado)">
                    <Input type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Imóveis"><Input type="number" value={form.imoveis} onChange={(e) => setForm({ ...form, imoveis: e.target.value })} /></Field>
                    <Field label="Usuários"><Input type="number" value={form.usuarios} onChange={(e) => setForm({ ...form, usuarios: e.target.value })} /></Field>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => saveEdit(p.id)}><Save className="mr-1 h-4 w-4" />Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="mr-1 h-4 w-4" />Cancelar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-3xl font-bold text-primary">
                    {formatBRL(p.preco_mensal)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cota de módulos opcionais</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-2xl font-bold">
                      {p.limites?.modulos === -1 ? <InfinityIcon className="h-6 w-6 text-primary" /> : formatQuota(p.limites?.modulos)}
                    </p>
                  </div>
                  <div className="mt-4 space-y-1 text-sm">
                    <Row label="Imóveis" value={formatQuota(p.limites?.imoveis ?? 0)} />
                    <Row label="Usuários" value={formatQuota(p.limites?.usuarios ?? 0)} />
                  </div>
                  <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => startEdit(p)}>
                    <Pencil className="mr-1 h-4 w-4" />Editar
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}