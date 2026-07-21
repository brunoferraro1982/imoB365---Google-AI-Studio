import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Save, X, Infinity as InfinityIcon, ArrowRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatQuota } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/admin/planos")({
  component: AdminPlanos,
});

type Plan = {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number | null;
  modulos_incluidos: string[];
  limites: Record<string, number>;
  ativo: boolean;
};

type ModuleRow = { slug: string; nome: string; core: boolean };

// Slugs seed com dependências hardcoded em funções SECURITY DEFINER
// (provision_trial_business, cron_expire_trials) — nunca oferecer exclusão via UI,
// independente de quantos tenants estão nesse plano hoje.
const CORE_PLAN_SLUGS = new Set(["free", "basic", "standard", "pro", "business"]);

function AdminPlanos() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [form, setForm] = useState<{ nome: string; preco: string; precoAnual: string }>({
    nome: "",
    preco: "",
    precoAnual: "",
  });
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({
    slug: "",
    nome: "",
    preco: "0",
    precoAnual: "0",
    modulos: [] as string[],
  });

  async function load() {
    setLoading(true);
    const [{ data }, { data: mods }] = await Promise.all([
      supabase.from("plans").select("*").order("preco_mensal"),
      supabase.from("modules").select("slug,nome,core").order("nome"),
    ]);
    const rows = (data as unknown as Plan[]) ?? [];
    setPlans(rows);
    setModules((mods as ModuleRow[]) ?? []);
    // Edge case: outra aba/admin excluiu o plano que está em edição aqui — sem isso,
    // "Salvar" viraria um update().eq("id", id) sem linha nenhuma pra atualizar (no-op silencioso).
    setEditing((current) => (current && !rows.some((p) => p.id === current) ? null : current));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Plan) {
    setEditing(p.id);
    setForm({
      nome: p.nome,
      preco: String(p.preco_mensal ?? 0),
      precoAnual: String(p.preco_anual ?? 0),
    });
  }

  async function saveEdit(id: string) {
    const payload = {
      nome: form.nome,
      preco_mensal: Number(form.preco) || 0,
      preco_anual: Number(form.precoAnual) || 0,
    };
    const { error } = await supabase.from("plans").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado");
    setEditing(null);
    load();
  }

  function toggleNewModulo(slug: string) {
    setNewPlan((p) => ({
      ...p,
      modulos: p.modulos.includes(slug)
        ? p.modulos.filter((m) => m !== slug)
        : [...p.modulos, slug],
    }));
  }

  async function createNew(e: FormEvent) {
    e.preventDefault();
    const slug = newPlan.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    if (!slug || !newPlan.nome.trim()) return toast.error("Slug e nome são obrigatórios");
    const { error } = await supabase.from("plans").insert({
      slug,
      nome: newPlan.nome.trim(),
      preco_mensal: Number(newPlan.preco) || 0,
      preco_anual: Number(newPlan.precoAnual) || 0,
      modulos_incluidos: newPlan.modulos,
      limites: { modulos: 0, imoveis: 0, usuarios: 0 },
      ativo: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Plano criado — edite os limites em Limites por plano");
    setCreating(false);
    setNewPlan({ slug: "", nome: "", preco: "0", precoAnual: "0", modulos: [] });
    load();
  }

  async function toggleAtivo(p: Plan) {
    const { error } = await supabase.from("plans").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  // Planos seed (CORE_PLAN_SLUGS) nunca chegam aqui — o botão já vem desabilitado pra
  // eles. Pra qualquer outro plano, tenants.plano_slug tem ON DELETE SET NULL (não
  // bloqueia a exclusão sozinho, só órfã o tenant em silêncio), então essa é a única
  // FK que precisa de pré-checagem client-side com mensagem amigável — as demais FKs
  // pra plans (assinaturas.plan_id, tenants.downgrade_to/plan_code) já são RESTRICT/NO
  // ACTION no Postgres e bloqueiam a exclusão sozinhas, surfaced pelo catch de erro abaixo.
  async function deletePlan(p: Plan) {
    if (CORE_PLAN_SLUGS.has(p.slug)) return;

    setLoading(true);
    const { count, error: checkError } = await supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("plano_slug", p.slug);
    setLoading(false);

    if (checkError) return toast.error(checkError.message);
    if ((count ?? 0) > 0) {
      return toast.error(
        `Não é possível excluir: ${count} imobiliária${count === 1 ? "" : "s"} ainda vinculada${count === 1 ? "" : "s"} a este plano.`,
      );
    }

    if (!(await confirmDialog(`Excluir o plano "${p.nome}"? Esta ação não pode ser desfeita.`)))
      return;

    setLoading(true);
    const { error } = await supabase.from("plans").delete().eq("id", p.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Plano excluído.");
    load();
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preço e módulos incluídos por plano. As cotas (imóveis, usuários, módulos opcionais) são
            editadas em{" "}
            <Link to="/admin/limites" className="text-primary underline">
              Limites por plano
            </Link>
            .
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> Novo plano
        </Button>
      </header>

      {creating && (
        <form
          onSubmit={createNew}
          className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-4"
        >
          <div>
            <Label className="text-xs">Slug</Label>
            <Input
              value={newPlan.slug}
              onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })}
              placeholder="enterprise"
            />
          </div>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={newPlan.nome}
              onChange={(e) => setNewPlan({ ...newPlan, nome: e.target.value })}
              placeholder="Enterprise"
            />
          </div>
          <div>
            <Label className="text-xs">Preço/mês</Label>
            <Input
              type="number"
              step="0.01"
              value={newPlan.preco}
              onChange={(e) => setNewPlan({ ...newPlan, preco: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Preço/ano</Label>
            <Input
              type="number"
              step="0.01"
              value={newPlan.precoAnual}
              onChange={(e) => setNewPlan({ ...newPlan, precoAnual: e.target.value })}
            />
          </div>
          <div className="md:col-span-4">
            <Label className="mb-2 block text-xs">Módulos incluídos</Label>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => toggleNewModulo(m.slug)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    newPlan.modulos.includes(m.slug)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 md:col-span-4">
            <Button type="submit" size="sm">
              <Save className="mr-1 h-4 w-4" />
              Criar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
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
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="h-8 max-w-[160px]"
                  />
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
              <p className="mt-1 text-xs text-muted-foreground">
                slug: <span className="font-mono">{p.slug}</span>
              </p>

              {editing === p.id ? (
                <div className="mt-4 space-y-3">
                  <Field label="Preço/mês (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.preco}
                      onChange={(e) => setForm({ ...form, preco: e.target.value })}
                    />
                  </Field>
                  <Field label="Preço/ano (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.precoAnual}
                      onChange={(e) => setForm({ ...form, precoAnual: e.target.value })}
                    />
                  </Field>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => saveEdit(p.id)}>
                      <Save className="mr-1 h-4 w-4" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="mr-1 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-3xl font-bold text-primary">
                    {formatBRL(p.preco_mensal)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.preco_anual ? `${formatBRL(p.preco_anual)}/ano` : "sem preço anual"}
                  </p>
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Cota de módulos opcionais
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-2xl font-bold">
                      {p.limites?.modulos === -1 ? (
                        <InfinityIcon className="h-6 w-6 text-primary" />
                      ) : (
                        formatQuota(p.limites?.modulos)
                      )}
                    </p>
                  </div>
                  <div className="mt-4 space-y-1 text-sm">
                    <Row label="Imóveis" value={formatQuota(p.limites?.imoveis ?? 0)} />
                    <Row label="Usuários" value={formatQuota(p.limites?.usuarios ?? 0)} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => startEdit(p)}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Editar preço
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/admin/limites">
                        Limites <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      disabled={CORE_PLAN_SLUGS.has(p.slug)}
                      title={
                        CORE_PLAN_SLUGS.has(p.slug)
                          ? "Planos padrão do sistema não podem ser excluídos"
                          : "Excluir plano"
                      }
                      onClick={() => deletePlan(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
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
