import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { Search, Save, Trash2, Plus, ExternalLink } from "lucide-react";
import { listSeoPages, saveSeoPage, deleteSeoPage, saveSeoGlobal } from "@/lib/seo.functions";

export const Route = createFileRoute("/admin/seo")({
  component: AdminSeoPage,
});

// Área de SEO / Google Search Console (Fase 2). Edita, sem deploy, os overrides
// de meta por página (seo_pages) e a config global (global_settings.seo_global).
// Escrita protegida por gate super_admin nas server functions + RLS. As rotas
// públicas leem via getSeoConfig (cache curto) — o efeito aparece no próximo
// carregamento. robots.txt e sitemap NÃO entram aqui (ficam no código).

type SeoPage = {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  og_image: string | null;
  updated_at: string;
};

type SeoGlobalForm = {
  default_og_image: string;
  search_action_target: string;
  gsc_verification: string;
  ga_measurement_id: string;
  ahrefs_analytics_key: string;
  org_description: string;
};

function AdminSeoPage() {
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [pages, setPages] = useState<SeoPage[]>([]);
  const [globalForm, setGlobalForm] = useState<SeoGlobalForm>({
    default_og_image: "",
    search_action_target: "",
    gsc_verification: "",
    ga_measurement_id: "",
    ahrefs_analytics_key: "",
    org_description: "",
  });
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await listSeoPages();
      setPages(res.pages as SeoPage[]);
      setGlobalForm({
        default_og_image: res.global.default_og_image ?? "",
        search_action_target: res.global.search_action_target ?? "",
        gsc_verification: res.global.gsc_verification ?? "",
        ga_measurement_id: res.global.ga_measurement_id ?? "",
        ahrefs_analytics_key: res.global.ahrefs_analytics_key ?? "",
        org_description: res.global.org?.description ?? "",
      });
    } catch (e) {
      toast.error("Erro ao carregar: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSaveGlobal() {
    setSavingGlobal(true);
    try {
      await saveSeoGlobal({ data: globalForm });
      toast.success("Configurações globais salvas");
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setSavingGlobal(false);
    }
  }

  async function onAddPage() {
    const path = newPath.trim();
    if (!path.startsWith("/")) {
      toast.error("O caminho deve começar com / (ex.: /consultoria)");
      return;
    }
    if (pages.some((p) => p.path === path)) {
      toast.error("Essa página já está na lista");
      return;
    }
    try {
      await saveSeoPage({ data: { path, noindex: false } });
      setNewPath("");
      toast.success("Página adicionada");
      load();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  }

  async function onDeletePage(page: SeoPage) {
    const ok = await confirmDialog(
      `A página "${page.path}" voltará a usar os textos padrão definidos no código.`,
      { title: "Remover override?", confirmLabel: "Remover", variant: "destructive" },
    );
    if (!ok) return;
    try {
      await deleteSeoPage({ data: { path: page.path } });
      toast.success("Override removido");
      load();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 p-6">
      <ConfirmDialog />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Search className="h-6 w-6 text-primary" />
          SEO &amp; Search Console
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste título, descrição e outras meta tags das páginas públicas sem precisar de deploy.
          Campos em branco usam o texto padrão do código. O efeito aparece no próximo carregamento
          da página (cache de ~1 min).
        </p>
      </div>

      {/* GLOBAL / SEARCH CONSOLE */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Global &amp; Google Search Console</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Valores usados no site inteiro. O token de verificação vira a meta tag
            <code className="mx-1 rounded bg-muted px-1 text-xs">google-site-verification</code>
            lida pelo Google Search Console.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Token de verificação (Search Console)</Label>
            <Input
              value={globalForm.gsc_verification}
              onChange={(e) => setGlobalForm((f) => ({ ...f, gsc_verification: e.target.value }))}
              placeholder="Ex.: google1234abcd..."
            />
            <p className="text-[11px] text-muted-foreground">
              No GSC, use a verificação por &ldquo;Tag HTML&rdquo; e cole aqui apenas o valor do
              atributo <code className="rounded bg-muted px-1">content</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Google Analytics (Measurement ID)</Label>
            <Input
              value={globalForm.ga_measurement_id}
              onChange={(e) => setGlobalForm((f) => ({ ...f, ga_measurement_id: e.target.value }))}
              placeholder="Ex.: G-XXXXXXXXXX"
            />
            <p className="text-[11px] text-muted-foreground">
              Cole só o ID <code className="rounded bg-muted px-1">G-XXXXXXXXXX</code> da tag do
              Google. Deixe em branco para desligar o Analytics.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ahrefs Web Analytics (data-key)</Label>
            <Input
              value={globalForm.ahrefs_analytics_key}
              onChange={(e) =>
                setGlobalForm((f) => ({ ...f, ahrefs_analytics_key: e.target.value }))
              }
              placeholder="Ex.: PSbPYvE9hFaWKmvrPzDhrg"
            />
            <p className="text-[11px] text-muted-foreground">
              Referência — o script do Ahrefs hoje está fixo no código-fonte, não é lido daqui
              ainda. Editar este campo não muda o site; é preparação para uma futura migração pro
              modelo editável, igual ao Google Analytics acima.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Imagem OG padrão (URL absoluta)</Label>
            <Input
              value={globalForm.default_og_image}
              onChange={(e) => setGlobalForm((f) => ({ ...f, default_og_image: e.target.value }))}
              placeholder="https://portal.imob365.com.br/og-default.png"
            />
            <p className="text-[11px] text-muted-foreground">
              Usada como imagem de compartilhamento quando a página não define a sua.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Alvo da busca (SearchAction)</Label>
            <Input
              value={globalForm.search_action_target}
              onChange={(e) =>
                setGlobalForm((f) => ({ ...f, search_action_target: e.target.value }))
              }
              placeholder="https://portal.imob365.com.br/buscar?q={search_term_string}"
            />
            <p className="text-[11px] text-muted-foreground">
              Habilita a caixa de busca de sitelinks do Google. Mantenha o
              <code className="mx-1 rounded bg-muted px-1">{"{search_term_string}"}</code> no fim.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição da organização (Schema)</Label>
            <Input
              value={globalForm.org_description}
              onChange={(e) => setGlobalForm((f) => ({ ...f, org_description: e.target.value }))}
              placeholder="imob365 — plataforma para imobiliárias"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSaveGlobal} disabled={savingGlobal}>
            <Save className="mr-2 h-4 w-4" />
            {savingGlobal ? "Salvando..." : "Salvar globais"}
          </Button>
        </div>
      </section>

      {/* PER-PAGE OVERRIDES */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Páginas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma entrada por caminho público. Deixe um campo em branco para usar o texto padrão.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Adicionar caminho</Label>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/nova-pagina"
                className="w-52"
              />
            </div>
            <Button variant="outline" onClick={onAddPage}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {pages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma página cadastrada ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} onDelete={() => onDeletePage(page)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PageCard({ page, onDelete }: { page: SeoPage; onDelete: () => void }) {
  const [form, setForm] = useState({
    title: page.title ?? "",
    description: page.description ?? "",
    canonical: page.canonical ?? "",
    og_image: page.og_image ?? "",
    noindex: page.noindex,
  });
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      await saveSeoPage({
        data: {
          path: page.path,
          title: form.title,
          description: form.description,
          canonical: form.canonical,
          og_image: form.og_image,
          noindex: form.noindex,
        },
      });
      toast.success(`SEO de ${page.path} salvo`);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {page.path}
          </Badge>
          {form.noindex && <Badge variant="destructive">noindex</Badge>}
          <a
            href={page.path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            abrir <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Remover
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Título (title / og:title)</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Padrão do código"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Canonical (URL)</Label>
          <Input
            value={form.canonical}
            onChange={(e) => setForm((f) => ({ ...f, canonical: e.target.value }))}
            placeholder="Auto (a própria URL da página)"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição (description / og:description)</Label>
        <Textarea
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Padrão do código"
        />
      </div>

      <div className="grid items-end gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Imagem OG (URL)</Label>
          <Input
            value={form.og_image}
            onChange={(e) => setForm((f) => ({ ...f, og_image: e.target.value }))}
            placeholder="Padrão global"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Não indexar (noindex)</p>
            <p className="text-[11px] text-muted-foreground">
              Remove esta página dos resultados de busca.
            </p>
          </div>
          <Switch
            checked={form.noindex}
            onCheckedChange={(v) => setForm((f) => ({ ...f, noindex: v }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
