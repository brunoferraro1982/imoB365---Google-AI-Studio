import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, FileText } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/blog")({
  component: BlogCMSPage,
});

// ─── Types ──────────────────────────────────────────────────────────────────

type BlogPost = {
  id: string;
  titulo: string;
  slug: string;
  excerpt: string | null;
  conteudo_html: string | null;
  imagem_capa_url: string | null;
  categorias: string[];
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  autor_nome: string | null;
};

type PostForm = Omit<BlogPost, "id" | "created_at" | "published_at">;

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { value: "investidor", label: "Investidor" },
  { value: "litoral-sul", label: "Litoral Sul" },
  { value: "planta", label: "Na Planta" },
  { value: "renda", label: "Renda" },
];

const EMPTY_FORM: PostForm = {
  titulo: "",
  slug: "",
  excerpt: "",
  conteudo_html: "",
  imagem_capa_url: "",
  categorias: [],
  status: "draft",
  autor_nome: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

// ─── Page ───────────────────────────────────────────────────────────────────

function BlogCMSPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select("id,titulo,slug,excerpt,conteudo_html,imagem_capa_url,categorias,status,published_at,created_at,autor_nome")
      .is("tenant_id", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPosts((data as BlogPost[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id);
    setForm({
      titulo: post.titulo,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      conteudo_html: post.conteudo_html ?? "",
      imagem_capa_url: post.imagem_capa_url ?? "",
      categorias: post.categorias ?? [],
      status: post.status,
      autor_nome: post.autor_nome ?? "",
    });
    setModalOpen(true);
  }

  function handleTituloChange(titulo: string) {
    setForm((f) => ({
      ...f,
      titulo,
      slug: editingId ? f.slug : slugify(titulo),
    }));
  }

  function toggleCategoria(cat: string) {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(cat)
        ? f.categorias.filter((c) => c !== cat)
        : [...f.categorias, cat],
    }));
  }

  async function save() {
    if (!form.titulo || !form.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }
    setSaving(true);

    const payload: any = {
      titulo: form.titulo,
      slug: form.slug,
      excerpt: form.excerpt || null,
      conteudo_html: form.conteudo_html || null,
      imagem_capa_url: form.imagem_capa_url || null,
      categorias: form.categorias,
      status: form.status,
      autor_nome: form.autor_nome || null,
      tenant_id: null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };

    let error: any;
    if (editingId) {
      // preserve published_at if already published
      const existing = posts.find((p) => p.id === editingId);
      if (existing?.published_at && form.status === "published") {
        payload.published_at = existing.published_at;
      }
      ({ error } = await (supabase as any)
        .from("blog_posts")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await (supabase as any).from("blog_posts").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Post atualizado" : "Post criado");
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Remover este post permanentemente?"))) return;
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  if (authLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="p-8">
      <ConfirmDialog />

      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CMS Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posts institucionais do blog público (tenant_id = null).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo post
        </Button>
      </header>

      {/* List */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Nenhum post criado ainda.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Título</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Publicado</th>
                <th className="text-left px-4 py-3 font-medium">Categorias</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-t border-border/60 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                >
                  <td className="px-4 py-3 font-medium max-w-xs truncate">
                    {p.titulo}
                    <span className="ml-2 font-normal text-muted-foreground text-xs">/{p.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "published" ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <Globe className="mr-1 h-3 w-3" />
                        Publicado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" />
                        Rascunho
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(p.published_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.categorias ?? []).map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {CATEGORIAS.find((x) => x.value === c)?.label ?? c}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar post" : "Novo post"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => handleTituloChange(e.target.value)}
                placeholder="Mercado imobiliário do Litoral Sul em 2026"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Slug *</Label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
                }
                placeholder="mercado-imobiliario-litoral-sul-2026"
              />
              <p className="text-[11px] text-muted-foreground">
                URL: /blog/<strong>{form.slug || "slug"}</strong>
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>Autor</Label>
              <Input
                value={form.autor_nome ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, autor_nome: e.target.value }))}
                placeholder="Equipe imoB365"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Excerpt</Label>
              <Textarea
                value={form.excerpt ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="Breve descrição do post para SEO e listagem…"
                rows={2}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>URL da imagem de capa</Label>
              <Input
                value={form.imagem_capa_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, imagem_capa_url: e.target.value }))}
                placeholder="https://..."
              />
              {form.imagem_capa_url && (
                <img
                  src={form.imagem_capa_url}
                  alt="capa"
                  className="mt-1 h-24 w-full rounded-lg object-cover border border-border"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Categorias</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategoria(cat.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      form.categorias.includes(cat.value)
                        ? "bg-primary text-white border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as "draft" | "published" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={form.conteudo_html ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, conteudo_html: e.target.value }))}
                placeholder="<h2>Introdução</h2><p>…</p>"
                rows={12}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
