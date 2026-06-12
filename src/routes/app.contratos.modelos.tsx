import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  BookOpen,
  Sparkles,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import TiptapUnderline from "@tiptap/extension-underline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "@/lib/contractTemplatesLibrary";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/contratos/modelos")({
  component: ModelosPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS = [
  "venda",
  "locacao",
  "permuta",
  "parceria",
  "administracao",
  "prestacao_servico",
  "outro",
] as const;

type Template = {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  ativo: boolean;
  updated_at: string;
};

// ─── Variable groups for the clickable chips panel ───────────────────────────

const VARIABLE_GROUPS = [
  {
    label: "Contrato",
    vars: [
      { label: "Número", value: "{{contrato.numero}}" },
      { label: "Valor", value: "{{contrato.valor}}" },
      { label: "Data início", value: "{{contrato.data_inicio}}" },
      { label: "Data fim", value: "{{contrato.data_fim}}" },
    ],
  },
  {
    label: "Imóvel",
    vars: [
      { label: "Título", value: "{{imovel.titulo}}" },
      { label: "Endereço", value: "{{imovel.endereco}}" },
      { label: "Cód. interno", value: "{{imovel.codigo_interno}}" },
    ],
  },
  {
    label: "Tenant",
    vars: [{ label: "Nome imobiliária", value: "{{tenant.nome}}" }],
  },
  {
    label: "Partes",
    vars: [
      { label: "Vendedor", value: "{{partes.vendedor}}" },
      { label: "Comprador", value: "{{partes.comprador}}" },
      { label: "Locador", value: "{{partes.locador}}" },
      { label: "Locatário", value: "{{partes.locatario}}" },
      { label: "Parceiro B", value: "{{partes.parceiro_b}}" },
    ],
  },
];

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "flex h-7 min-w-[28px] select-none items-center justify-center rounded px-1.5 text-sm transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "text-foreground hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── WYSIWYG Editor ───────────────────────────────────────────────────────────

interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function WysiwygEditor({ value, onChange }: WysiwygEditorProps) {
  // Inject scoped prose styles for the ProseMirror content area
  useEffect(() => {
    const STYLE_ID = "wysiwyg-contract-prose";
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
      .wysiwyg-contract .ProseMirror {
        outline: none;
        min-height: 420px;
        padding: 32px 40px;
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 14px;
        line-height: 1.85;
        color: inherit;
      }
      .wysiwyg-contract .ProseMirror h1 {
        font-size: 1.55rem; font-weight: 700; text-align: center;
        margin: 0 0 18px; font-family: inherit;
      }
      .wysiwyg-contract .ProseMirror h2 {
        font-size: 1.15rem; font-weight: 700;
        margin: 22px 0 8px; font-family: inherit;
      }
      .wysiwyg-contract .ProseMirror h3 {
        font-size: 1rem; font-weight: 600;
        margin: 16px 0 6px; font-family: inherit;
      }
      .wysiwyg-contract .ProseMirror p { margin: 0 0 10px; }
      .wysiwyg-contract .ProseMirror ul { list-style: disc; padding-left: 28px; margin: 0 0 10px; }
      .wysiwyg-contract .ProseMirror ol { list-style: decimal; padding-left: 28px; margin: 0 0 10px; }
      .wysiwyg-contract .ProseMirror li { margin-bottom: 4px; }
      .wysiwyg-contract .ProseMirror strong { font-weight: 700; }
      .wysiwyg-contract .ProseMirror em { font-style: italic; }
      .wysiwyg-contract .ProseMirror u { text-decoration: underline; }
      .wysiwyg-contract .ProseMirror p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
        float: left;
        height: 0;
      }
    `;
    document.head.appendChild(el);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TiptapUnderline,
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const insertVar = useCallback(
    (v: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(v).run();
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="wysiwyg-contract overflow-hidden rounded-lg border border-input shadow-sm">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5">
        {/* Formatting */}
        <ToolbarBtn
          title="Negrito (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Itálico (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Sublinhado (Ctrl+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        {/* Headings */}
        <ToolbarBtn
          title="Título 1 — Nome/cabeçalho do contrato"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
        >
          <span className="text-[11px] font-bold leading-none">H1</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Título 2 — Cláusula"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
        >
          <span className="text-[11px] font-bold leading-none">H2</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Título 3 — Subcláusula"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
        >
          <span className="text-[11px] font-bold leading-none">H3</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Parágrafo normal"
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph") && !editor.isActive("heading")}
        >
          <span className="text-[11px] font-normal leading-none">¶</span>
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        {/* Alignment */}
        <ToolbarBtn
          title="Alinhar à esquerda"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Centralizar"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Alinhar à direita"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        {/* Lists */}
        <ToolbarBtn
          title="Lista com marcadores"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>

        {/* Keyboard shortcut hint */}
        <div className="ml-auto text-[10px] text-muted-foreground pr-1 hidden sm:block">
          Ctrl+B · Ctrl+I · Ctrl+U
        </div>
      </div>

      {/* ── Paper-like editing area ───────────────────────────── */}
      <div className="max-h-[520px] overflow-y-auto bg-white dark:bg-zinc-950">
        <EditorContent editor={editor} />
      </div>

      {/* ── Variable chips panel ──────────────────────────────── */}
      <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Clique para inserir variável no cursor
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1">
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {group.label}:
              </span>
              {group.vars.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  title={`Inserir ${v.value}`}
                  onClick={() => insertVar(v.value)}
                  className="inline-flex cursor-pointer items-center rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-800/50"
                >
                  {v.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

function ModelosPage() {
  const { tenantId, user } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();

  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  // editorKey forces WysiwygEditor remount on each template switch
  const [editorKey, setEditorKey] = useState(0);
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

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  function novo() {
    setEditing({ id: "", nome: "", tipo: "venda", conteudo: "", ativo: true, updated_at: "" });
    setEditorKey((k) => k + 1);
  }

  function startEdit(t: Template) {
    setEditing(t);
    setEditorKey((k) => k + 1);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || !tenantId) return;
    if (editing.nome.trim().length < 2) return toast.error("Informe o nome do modelo");
    setSaving(true);

    if (editing.id) {
      const { error } = await supabase
        .from("contrato_templates")
        .update({
          nome: editing.nome.trim(),
          tipo: editing.tipo as any,
          conteudo: editing.conteudo,
          ativo: editing.ativo,
        })
        .eq("id", editing.id);
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
    if (!(await confirmDialog("Excluir este modelo permanentemente?"))) return;
    const { error } = await supabase.from("contrato_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function applyBuiltinTemplate(tpl: BuiltinTemplate) {
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
      <Link
        to="/app/contratos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Jurídico
      </Link>

      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modelos de contrato</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Templates reutilizáveis para geração de documentos.
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLibrary((v) => !v)}>
              <BookOpen className="mr-2 h-4 w-4" />
              {showLibrary ? "Fechar biblioteca" : "Biblioteca de modelos"}
            </Button>
            <Button onClick={novo}>
              <Plus className="mr-2 h-4 w-4" /> Novo modelo
            </Button>
          </div>
        )}
      </header>

      {/* ── Built-in library ─────────────────────────────────────── */}
      {!editing && showLibrary && (
        <section className="mb-8 rounded-xl border border-border bg-muted/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Biblioteca de modelos prontos</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Modelos jurídicos pré-elaborados para imobiliárias. Clique em "Usar este modelo" para
            clonar para a sua conta — você poderá editar livremente depois.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {BUILTIN_TEMPLATES.map((tpl) => (
              <div
                key={tpl.slug}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{tpl.nome}</div>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {tpl.tipo.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tpl.descricao}</p>
                <div className="mt-1 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cloning === tpl.slug}
                    onClick={() => applyBuiltinTemplate(tpl)}
                  >
                    {cloning === tpl.slug ? "Adicionando…" : "Usar este modelo"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Editor form ──────────────────────────────────────────── */}
      {editing ? (
        <form
          onSubmit={save}
          className="max-w-4xl space-y-5 rounded-xl border border-border bg-card p-6"
        >
          {/* Nome + Tipo */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
              <Input
                value={editing.nome}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                placeholder="Ex: Contrato de Locação Residencial"
                maxLength={120}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Tipo</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.tipo}
                onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* WYSIWYG editor — remounts on template switch via key */}
          <div>
            <Label className="mb-2 block text-xs uppercase text-muted-foreground">
              Conteúdo do modelo
            </Label>
            <WysiwygEditor
              key={editorKey}
              value={editing.conteudo}
              onChange={(html) => setEditing({ ...editing, conteudo: html })}
            />
          </div>

          {/* Ativo toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.ativo}
              onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Modelo ativo (disponível para uso em contratos)
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar modelo"}
            </Button>
          </div>
        </form>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>
          <Button size="sm" className="mt-4" onClick={novo}>
            Criar primeiro modelo
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.nome}</span>
                  <Badge variant="secondary" className="capitalize">
                    {t.tipo.replace("_", " ")}
                  </Badge>
                  {!t.ativo && <Badge variant="outline">Inativo</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Atualizado em {new Date(t.updated_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                  Editar
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
