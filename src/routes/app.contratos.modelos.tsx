import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2, FileText, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "@/lib/contractTemplatesLibrary";

export const Route = createFileRoute("/app/contratos/modelos")({
  component: ModelosPage,
});

const TIPOS = ["venda", "locacao", "permuta", "parceria", "administracao", "prestacao_servico", "outro"] as const;

type Template = {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  ativo: boolean;
  updated_at: string;
};

const PLACEHOLDER_HINT = `Variáveis disponíveis (use entre chaves):
{{contrato.numero}} {{contrato.valor}} {{contrato.data_inicio}} {{contrato.data_fim}}
{{imovel.titulo}} {{imovel.endereco}} {{imovel.codigo_interno}}
{{tenant.nome}} {{partes.vendedor}} {{partes.comprador}} {{partes.locador}} {{partes.locatario}}`;

function ModelosPage() {
  const { tenantId, user } = useAuth();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_templates")
      .select("id,nome,tipo,conteudo,ativo,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Template[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function novo() {
    setEditing({ id: "", nome: "", tipo: "venda", conteudo: "", ativo: true, updated_at: "" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || !tenantId) return;
    if (editing.nome.trim().length < 2) return toast.error("Informe o nome");
    setSaving(true);
    if (editing.id) {
      const { error } = await supabase.from("contrato_templates").update({
        nome: editing.nome.trim(),
        tipo: editing.tipo as any,
        conteudo: editing.conteudo,
        ativo: editing.ativo,
      }).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Modelo atualizado");
    } else {
      const { error } = await supabase.from("contrato_templates").insert({
        tenant_id: tenantId,
        nome: editing.nome.trim(),
        tipo: editing.tipo as any,
        conteudo: editing.conteudo,
        ativo: editing.ativo,
        created_by: user?.id,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Modelo criado");
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("contrato_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function useBuiltin(tpl: BuiltinTemplate) {
    if (!tenantId) return;
    setCloning(tpl.slug);
    const { error } = await supabase.from("contrato_templates").insert({
      tenant_id: tenantId,
      nome: tpl.nome,
      tipo: tpl.tipo as any,
      conteudo: tpl.conteudo,
      ativo: true,
      created_by: user?.id,
    });
    setCloning(null);
    if (error) return toast.error(error.message);
    toast.success(`"${tpl.nome}" adicionado aos seus modelos`);
    load();
  }

  return (
    <div className="p-8">
      <Link to="/app/contratos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para Jurídico
      </Link>
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modelos de contrato</h1>
          <p className="mt-1 text-sm text-muted-foreground">Templates reutilizáveis para geração de documentos.</p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLibrary((v) => !v)}>
              <BookOpen className="mr-2 h-4 w-4" /> {showLibrary ? "Fechar biblioteca" : "Biblioteca de modelos"}
            </Button>
            <Button onClick={novo}><Plus className="mr-2 h-4 w-4" /> Novo modelo</Button>
          </div>
        )}
      </header>

      {!editing && showLibrary && (
        <section className="mb-8 rounded-xl border border-border bg-muted/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Biblioteca de modelos prontos</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Modelos jurídicos pré-elaborados para imobiliárias. Clique em "Usar este modelo" para clonar para a sua conta — você poderá editar livremente depois.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {BUILTIN_TEMPLATES.map((tpl) => (
              <div key={tpl.slug} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{tpl.nome}</div>
                    <Badge variant="secondary" className="mt-1 capitalize">{tpl.tipo.replace("_", " ")}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tpl.descricao}</p>
                <div className="mt-1 flex justify-end">
                  <Button size="sm" variant="outline" disabled={cloning === tpl.slug} onClick={() => useBuiltin(tpl)}>
                    {cloning === tpl.slug ? "Adicionando…" : "Usar este modelo"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {editing ? (
        <form onSubmit={save} className="max-w-4xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
              <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Tipo</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.tipo}
                onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Conteúdo (HTML simples)</Label>
            <Textarea
              rows={18}
              value={editing.conteudo}
              onChange={(e) => setEditing({ ...editing, conteudo: e.target.value })}
              className="font-mono text-xs"
              placeholder="Exemplo: <h1>Contrato de {{contrato.tipo}}</h1><p>Pelo presente instrumento…</p>"
            />
            <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.ativo} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })} />
            Ativo
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar modelo"}</Button>
          </div>
        </form>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>
          <Button size="sm" className="mt-4" onClick={novo}>Criar primeiro modelo</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.nome}</span>
                  <Badge variant="secondary" className="capitalize">{t.tipo}</Badge>
                  {!t.ativo && <Badge variant="outline">Inativo</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Atualizado em {new Date(t.updated_at).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}