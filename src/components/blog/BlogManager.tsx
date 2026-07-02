import { useEffect, useState, useMemo, type FormEvent } from "react";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Edit,
  Search,
  FileText,
  RefreshCw,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";

// ─── Types ──────────────────────────────────────────────────────────────────
// Colunas reais da tabela blog_posts (tenant_id NOT NULL — cada linha
// pertence a um tenant específico, isolado por RLS). Este componente é
// reaproveitado tanto pelo blog de cada imobiliária/corretor (tenantId =
// tenant logado, via /app/site/blog) quanto pelo blog institucional do
// imoB365 (tenantId = tenant "imob365", via /admin/blog).

type BlogPost = {
  id: string;
  tenant_id: string;
  titulo: string;
  slug: string;
  conteudo: string | null;
  resumo: string | null;
  imagem_url: string | null;
  categoria: string | null;
  status: "rascunho" | "publicado";
  autor_id: string | null;
  autor?: { nome: string | null } | null;
  seo_titulo: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  publicado_em: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_POST: Partial<BlogPost> = {
  titulo: "",
  slug: "",
  conteudo: "",
  resumo: "",
  imagem_url: "",
  status: "rascunho",
  categoria: "Mercado Imobiliário",
  seo_titulo: "",
  seo_description: "",
  seo_keywords: "",
};

type Props = {
  tenantId: string | null;
  title?: string;
  subtitle?: string;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function BlogManager({
  tenantId,
  title = "Blog Imobiliário",
  subtitle = "Crie artigos para melhorar o ranqueamento orgânico (SEO), educar clientes e gerar mais contatos qualificados.",
}: Props) {
  const { user } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"todos" | "publicados" | "rascunhos">("todos");
  const [isEditing, setIsEditing] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<BlogPost>>(EMPTY_POST);
  const [formActiveTab, setFormActiveTab] = useState<"conteudo" | "seo">("conteudo");

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ─── Data ────────────────────────────────────────────────────────────────

  async function loadPosts() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*, autor:profiles(nome)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setPosts([]);
    } else {
      setPosts((data as unknown as BlogPost[]) ?? []);
    }
    setLoading(false);
  }

  // ─── Derived State ────────────────────────────────────────────────────────

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchSearch =
        post.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.categoria ?? "").toLowerCase().includes(searchTerm.toLowerCase());

      if (activeTab === "publicados") return matchSearch && post.status === "publicado";
      if (activeTab === "rascunhos") return matchSearch && post.status === "rascunho";
      return matchSearch;
    });
  }, [posts, searchTerm, activeTab]);

  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === "publicado").length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [posts]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    if (!currentPost.titulo?.trim()) {
      return toast.error("Por favor, digite o título do artigo.");
    }

    setSaving(true);
    const slugValue = currentPost.slug?.trim() || slugify(currentPost.titulo || "");
    const isNew = !currentPost.id;

    const payload = {
      tenant_id: tenantId,
      titulo: currentPost.titulo.trim(),
      slug: slugValue,
      conteudo: currentPost.conteudo || "",
      resumo: currentPost.resumo?.trim() || null,
      imagem_url: currentPost.imagem_url?.trim() || null,
      status: currentPost.status || "rascunho",
      categoria: currentPost.categoria || null,
      autor_id: currentPost.autor_id || user?.id || null,
      seo_titulo: currentPost.seo_titulo?.trim() || currentPost.titulo.trim(),
      seo_description: currentPost.seo_description?.trim() || null,
      seo_keywords: currentPost.seo_keywords?.trim() || null,
      publicado_em:
        currentPost.status === "publicado"
          ? currentPost.publicado_em || new Date().toISOString()
          : null,
    };

    try {
      if (!isNew) {
        const { error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", currentPost.id);
        if (error) throw error;
        toast.success("Artigo atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
        toast.success("Artigo publicado com sucesso!");
      }
      setIsEditing(false);
      setCurrentPost(EMPTY_POST);
      loadPosts();
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog("Tem certeza que deseja remover este artigo permanentemente?")))
      return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Artigo removido com sucesso!");
      loadPosts();
    }
  }

  const handleTituloChange = (val: string) => {
    setCurrentPost((p) => ({
      ...p,
      titulo: val,
      slug: p.id ? p.slug : slugify(val),
    }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      {!isEditing ? (
        <>
          {/* HEADER */}
          <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <Bookmark className="h-3.5 w-3.5 fill-primary/10" />
                <span>Blog</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                {title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
            </div>

            <Button
              onClick={() => {
                setCurrentPost(EMPTY_POST);
                setIsEditing(true);
              }}
              className="shadow-md"
            >
              <Plus className="mr-2 h-4 w-4 stroke-[2.5]" /> Novo Artigo
            </Button>
          </header>

          {/* STATS BENTO ROW */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Total de Artigos
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{stats.total}</span>
                <span className="text-xs text-muted-foreground font-medium">unidades</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Publicados
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {stats.published}
                </span>
                <span className="text-xs text-emerald-600/80 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  No Ar
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rascunhos
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {stats.drafts}
                </span>
                <span className="text-xs text-amber-600/80 font-medium font-mono">Pendente</span>
              </div>
            </div>
          </div>

          {/* TAB BAR & SEARCH */}
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex gap-1.5 bg-muted/65 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("todos")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === "todos"
                    ? "bg-white dark:bg-neutral-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTab("publicados")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === "publicados"
                    ? "bg-white dark:bg-neutral-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ativos/Publicados
              </button>
              <button
                onClick={() => setActiveTab("rascunhos")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === "rascunhos"
                    ? "bg-white dark:bg-neutral-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rascunhos
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>

          {/* CONTENT LIST */}
          {loading ? (
            <div className="flex items-center justify-center p-20 text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" /> Carregando artigos do
              blog...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                Nenhum artigo encontrado
              </p>
              <p className="text-xs text-muted-foreground/75 mt-1">
                Clique em "Novo Artigo" para estrear seu blog imobiliário!
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs transition-all hover:shadow-md hover:border-primary/30"
                >
                  {/* IMAGEM */}
                  <div className="relative aspect-video w-full bg-muted overflow-hidden">
                    {post.imagem_url ? (
                      <img
                        src={post.imagem_url}
                        alt={post.titulo}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary">
                        <FileText className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3 bg-neutral-900/80 hover:bg-neutral-900 backdrop-blur-xs text-[10px] font-bold">
                      {post.categoria || "Geral"}
                    </Badge>
                  </div>

                  {/* INFO */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.publicado_em
                          ? new Date(post.publicado_em).toLocaleDateString("pt-BR")
                          : "Não publicado"}
                      </span>
                      {post.autor?.nome && (
                        <span className="text-[10px] truncate max-w-[120px]">
                          {post.autor.nome}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-neutral-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors mb-2">
                      {post.titulo}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                      {post.resumo || "Sem descrição ou resumo adicionado."}
                    </p>

                    <div className="mt-auto border-t border-border/50 pt-4 flex items-center justify-between">
                      <Badge
                        variant={post.status === "publicado" ? "default" : "secondary"}
                        className="font-bold"
                      >
                        {post.status === "publicado" ? "PUBLICADO" : "RASCUNHO"}
                      </Badge>

                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => {
                            setCurrentPost(post);
                            setIsEditing(true);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-600 hover:text-primary hover:bg-primary/5"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(post.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-destructive hover:bg-destructive/5"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ─── EDITOR ──────────────────────────────────────────────────────── */
        <div className="max-w-4xl mx-auto">
          {/* HEADER EDITOR */}
          <div className="mb-6 flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsEditing(false)}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <h2 className="text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                {currentPost.id ? "Editar Artigo" : "Criar Novo Artigo"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={currentPost.status === "publicado" ? "default" : "secondary"}
                className="font-extrabold"
              >
                {currentPost.status === "publicado" ? "NO AR" : "RASCUNHO"}
              </Badge>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-12">
              {/* MAIN CONTENT (8 cols) */}
              <div className="md:col-span-8 space-y-5">
                {/* TABS */}
                <div className="flex border-b border-border/75">
                  <button
                    type="button"
                    onClick={() => setFormActiveTab("conteudo")}
                    className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                      formActiveTab === "conteudo"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    1. Conteúdo Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormActiveTab("seo")}
                    className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                      formActiveTab === "seo"
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    2. Configurações de SEO (Google)
                  </button>
                </div>

                {formActiveTab === "conteudo" ? (
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
                    {/* Título */}
                    <div>
                      <Label htmlFor="post-titulo" className="text-xs font-bold text-foreground">
                        Título do Artigo <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="post-titulo"
                        placeholder="Ex: 5 bairros em crescimento para morar com a família"
                        value={currentPost.titulo || ""}
                        onChange={(e) => handleTituloChange(e.target.value)}
                        required
                        className="mt-1.5 focus-visible:ring-primary"
                      />
                    </div>

                    {/* Slug + Categoria */}
                    <div className="grid gap-4 grid-cols-2">
                      <div>
                        <Label htmlFor="post-slug" className="text-xs font-bold text-foreground">
                          URL Slug (Endereço amigável)
                        </Label>
                        <Input
                          id="post-slug"
                          placeholder="Ex: 5-bairros-em-crescimento"
                          value={currentPost.slug || ""}
                          onChange={(e) =>
                            setCurrentPost((p) => ({ ...p, slug: slugify(e.target.value) }))
                          }
                          className="mt-1.5 font-mono text-xs focus-visible:ring-primary"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="post-categoria"
                          className="text-xs font-bold text-foreground"
                        >
                          Categoria
                        </Label>
                        <select
                          id="post-categoria"
                          value={currentPost.categoria || "Mercado Imobiliário"}
                          onChange={(e) =>
                            setCurrentPost((p) => ({ ...p, categoria: e.target.value }))
                          }
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="Mercado Imobiliário">Mercado Imobiliário</option>
                          <option value="Financiamentos">Financiamentos</option>
                          <option value="Decoração & Reforma">Decoração &amp; Reforma</option>
                          <option value="Dicas de Venda">Dicas de Venda</option>
                          <option value="Eventos Locais">Eventos Locais</option>
                          <option value="Investidor">Investidor</option>
                          <option value="Litoral Sul">Litoral Sul</option>
                          <option value="Na Planta">Na Planta</option>
                          <option value="Renda">Renda</option>
                        </select>
                      </div>
                    </div>

                    {/* Imagem */}
                    <div>
                      <Label htmlFor="post-imagem" className="text-xs font-bold text-foreground">
                        URL da Imagem de Capa
                      </Label>
                      <div className="mt-1.5 flex gap-2">
                        <Input
                          id="post-imagem"
                          placeholder="https://images.unsplash.com/photo-..."
                          value={currentPost.imagem_url || ""}
                          onChange={(e) =>
                            setCurrentPost((p) => ({ ...p, imagem_url: e.target.value }))
                          }
                          className="text-xs"
                        />
                      </div>
                      {currentPost.imagem_url && (
                        <img
                          src={currentPost.imagem_url}
                          alt="capa"
                          className="mt-2 h-24 w-full rounded-lg object-cover border border-border"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      )}
                    </div>

                    {/* Resumo */}
                    <div>
                      <Label htmlFor="post-resumo" className="text-xs font-bold text-foreground">
                        Breve Resumo (Introdução resumida para redes e buscas)
                      </Label>
                      <Textarea
                        id="post-resumo"
                        rows={2}
                        placeholder="Ex: Aprenda quais fatores fazem de um bairro propício à valorização rápida."
                        value={currentPost.resumo || ""}
                        onChange={(e) => setCurrentPost((p) => ({ ...p, resumo: e.target.value }))}
                        className="mt-1.5 text-xs"
                      />
                    </div>

                    {/* Conteúdo HTML */}
                    <div>
                      <Label
                        htmlFor="post-conteudo"
                        className="text-xs font-bold text-foreground flex items-center justify-between"
                      >
                        <span>Texto Completo do Artigo (HTML)</span>
                        <span className="text-[10px] text-muted-foreground">
                          Suporta tags HTML: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, etc.
                        </span>
                      </Label>
                      <Textarea
                        id="post-conteudo"
                        rows={12}
                        placeholder="<h2>Introdução</h2>&#10;<p>Escreva seu artigo aqui...</p>"
                        value={currentPost.conteudo || ""}
                        onChange={(e) =>
                          setCurrentPost((p) => ({ ...p, conteudo: e.target.value }))
                        }
                        className="mt-1.5 font-mono text-xs leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  /* SEO TAB */
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
                    <div className="flex items-start gap-3 p-3.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-400 text-xs mb-3">
                      <Sparkles className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Como funciona o SEO Imobiliário?</span>
                        <p className="mt-0.5 text-[11px] text-indigo-800/80 dark:text-indigo-400/80 leading-normal">
                          Essas informações são consumidas diretamente pelo Google e buscadores
                          parceiros para indexar seu site. Ao configurá-las corretamente, o seu blog
                          ganha prioridade orgânica.
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="post-seo-title" className="text-xs font-bold text-foreground">
                        Título SEO (Exibido na guia do navegador e resultados do Google)
                      </Label>
                      <Input
                        id="post-seo-title"
                        placeholder="Ex: Guia Completo para Financiar Imóvel em 2026"
                        value={currentPost.seo_titulo || ""}
                        onChange={(e) =>
                          setCurrentPost((p) => ({ ...p, seo_titulo: e.target.value }))
                        }
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="post-seo-desc" className="text-xs font-bold text-foreground">
                        Meta Description (Sua vitrine nos resultados do Google)
                      </Label>
                      <Textarea
                        id="post-seo-desc"
                        rows={3}
                        placeholder="Ex: Faça as contas perfeitas e aprenda as novas taxas de juros bancários vigentes..."
                        value={currentPost.seo_description || ""}
                        onChange={(e) =>
                          setCurrentPost((p) => ({ ...p, seo_description: e.target.value }))
                        }
                        className="mt-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="post-seo-keywords"
                        className="text-xs font-bold text-foreground"
                      >
                        Palavras-chave (Separadas por vírgula)
                      </Label>
                      <Input
                        id="post-seo-keywords"
                        placeholder="Ex: financiar apartamento, caixa economica, juros habitacionais"
                        value={currentPost.seo_keywords || ""}
                        onChange={(e) =>
                          setCurrentPost((p) => ({ ...p, seo_keywords: e.target.value }))
                        }
                        className="mt-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SIDEBAR (4 cols) */}
              <div className="md:col-span-4 space-y-4">
                {/* Status */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90 mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Status &amp; Publicação
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold">Estado do Artigo</Label>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPost((p) => ({ ...p, status: "rascunho" }))}
                          className={`flex items-center justify-center py-2 text-xs font-extrabold rounded-lg border transition-all ${
                            currentPost.status === "rascunho"
                              ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          Rascunho
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPost((p) => ({ ...p, status: "publicado" }))}
                          className={`flex items-center justify-center py-2 text-xs font-extrabold rounded-lg border transition-all ${
                            currentPost.status === "publicado"
                              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          Publicar No Ar
                        </button>
                      </div>
                    </div>

                    <div className="bg-muted/40 p-3 rounded-lg border border-border/50 text-2xs space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Slug ativo:</span>
                        <span className="font-mono truncate max-w-[100px]">
                          {currentPost.slug || "Automático"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Visibilidade:</span>
                        <span className="font-semibold text-emerald-600">Pública</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Autor info */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-500" />
                    Autor (sessão ativa)
                  </h4>
                  <div className="flex items-center gap-2.5 bg-muted/30 p-2.5 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {user?.email?.charAt(0) || "U"}
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-foreground">
                        {currentPost.autor?.nome ?? "Você"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button type="submit" disabled={saving} className="w-full font-bold shadow-md">
                    {saving
                      ? "Salvando..."
                      : currentPost.id
                        ? "Atualizar Artigo"
                        : "Cadastrar Artigo"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="w-full text-xs"
                  >
                    Descartar Alterações
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
