import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Building2,
  Newspaper,
  Phone,
  Share2,
  Megaphone,
  FileText,
  Upload,
  Eye,
  EyeOff,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useConfirm } from "@/hooks/useConfirm";
import { saveTenantWidget } from "@/lib/siteContent.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/site/widgets-conteudo")({
  component: WidgetsConteudoPage,
});

type Widget = {
  id: string;
  tipo:
    | "imoveis_recentes"
    | "blog_recente"
    | "contato"
    | "redes_sociais"
    | "banner_publicitario"
    | "texto_livre";
  posicao: "esquerda" | "direita";
  ordem: number;
  titulo: string | null;
  ativo: boolean;
  config: Record<string, any>;
};

const TIPO_INFO: Record<Widget["tipo"], { label: string; desc: string; icon: typeof Building2 }> = {
  imoveis_recentes: {
    label: "Imóveis recentes",
    desc: "Mostra os últimos imóveis publicados",
    icon: Building2,
  },
  blog_recente: {
    label: "Posts do blog",
    desc: "Mostra os artigos mais recentes",
    icon: Newspaper,
  },
  contato: { label: "Contato rápido", desc: "Telefone, email e WhatsApp", icon: Phone },
  redes_sociais: { label: "Redes sociais", desc: "Ícones para suas redes", icon: Share2 },
  banner_publicitario: {
    label: "Banner publicitário",
    desc: "Imagem + link para divulgar algo",
    icon: Megaphone,
  },
  texto_livre: { label: "Texto livre", desc: "Um aviso, selo ou texto qualquer", icon: FileText },
};

const EMPTY_WIDGET: Omit<Widget, "id"> = {
  tipo: "imoveis_recentes",
  posicao: "direita",
  ordem: 0,
  titulo: "",
  ativo: true,
  config: {},
};

function WidgetsConteudoPage() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const saveWidget = useServerFn(saveTenantWidget);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Widget | Omit<Widget, "id"> | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_site_widgets")
      .select("id,tipo,posicao,ordem,titulo,ativo,config")
      .eq("tenant_id", tenantId)
      .order("posicao")
      .order("ordem");
    setWidgets((data as Widget[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function startNew(tipo: Widget["tipo"]) {
    const maxOrdem = Math.max(
      0,
      ...widgets.filter((w) => w.posicao === "direita").map((w) => w.ordem),
    );
    setEditing({ ...EMPTY_WIDGET, tipo, ordem: maxOrdem + 1 });
    setPicking(false);
  }

  async function save() {
    if (!editing || !tenantId) return;
    setSaving(true);
    const isNew = !("id" in editing);
    try {
      await saveWidget({
        data: {
          ...editing,
          id: "id" in editing ? editing.id : undefined,
          tenant_id: tenantId,
        },
      });
      toast.success(isNew ? "Widget adicionado" : "Widget atualizado");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar widget");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Remover este widget do site?"))) return;
    const { error } = await supabase.from("tenant_site_widgets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function toggleAtivo(w: Widget) {
    await supabase.from("tenant_site_widgets").update({ ativo: !w.ativo }).eq("id", w.id);
    load();
  }

  async function move(w: Widget, dir: -1 | 1) {
    const grupo = widgets.filter((x) => x.posicao === w.posicao).sort((a, b) => a.ordem - b.ordem);
    const idx = grupo.findIndex((x) => x.id === w.id);
    const swapWith = grupo[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("tenant_site_widgets").update({ ordem: swapWith.ordem }).eq("id", w.id),
      supabase.from("tenant_site_widgets").update({ ordem: w.ordem }).eq("id", swapWith.id),
    ]);
    load();
  }

  async function uploadBannerImagem(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !editing) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Imagem deve ter no máximo 2MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${tenantId}/banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("site-widgets")
      .upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("site-widgets").getPublicUrl(path);
    setEditing({ ...editing, config: { ...editing.config, imagem_url: pub.publicUrl } });
    setUploading(false);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const esquerda = widgets
    .filter((w) => w.posicao === "esquerda")
    .sort((a, b) => a.ordem - b.ordem);
  const direita = widgets.filter((w) => w.posicao === "direita").sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="p-8">
      <Link
        to="/app/site"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Site da imobiliária
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Widgets de conteúdo</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Monte as barras laterais do seu site: imóveis em destaque, posts do blog, contato, redes
          sociais, banners e avisos — igual a um site WordPress, o layout central fica com a
          informação essencial e as laterais reforçam sua divulgação.
        </p>
      </header>

      {editing ? (
        <WidgetForm
          editing={editing}
          setEditing={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={saving}
          uploading={uploading}
          onUploadBanner={uploadBannerImagem}
        />
      ) : picking ? (
        <div className="max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Escolha um tipo de widget</h2>
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Cancelar
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(TIPO_INFO) as Widget["tipo"][]).map((tipo) => {
              const info = TIPO_INFO[tipo];
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => startNew(tipo)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <info.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{info.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{info.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <Button className="mb-8" onClick={() => setPicking(true)}>
            + Adicionar widget
          </Button>

          <div className="grid gap-6 lg:grid-cols-2">
            <WidgetColumn
              titulo="Barra lateral esquerda"
              widgets={esquerda}
              onEdit={setEditing}
              onRemove={remove}
              onToggle={toggleAtivo}
              onMove={move}
            />
            <WidgetColumn
              titulo="Barra lateral direita"
              widgets={direita}
              onEdit={setEditing}
              onRemove={remove}
              onToggle={toggleAtivo}
              onMove={move}
            />
          </div>
        </>
      )}
      <ConfirmDialog />
    </div>
  );
}

function WidgetColumn({
  titulo,
  widgets,
  onEdit,
  onRemove,
  onToggle,
  onMove,
}: {
  titulo: string;
  widgets: Widget[];
  onEdit: (w: Widget) => void;
  onRemove: (id: string) => void;
  onToggle: (w: Widget) => void;
  onMove: (w: Widget, dir: -1 | 1) => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      {widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          Nenhum widget aqui ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {widgets.map((w, i) => {
            const info = TIPO_INFO[w.tipo];
            return (
              <div
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <info.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.titulo || info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                </div>
                {!w.ativo && (
                  <Badge variant="outline" className="shrink-0">
                    Oculto
                  </Badge>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === 0}
                    onClick={() => onMove(w, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === widgets.length - 1}
                    onClick={() => onMove(w, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onToggle(w)}
                  >
                    {w.ativo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onEdit(w)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onRemove(w.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WidgetForm({
  editing,
  setEditing,
  onCancel,
  onSave,
  saving,
  uploading,
  onUploadBanner,
}: {
  editing: Widget | Omit<Widget, "id">;
  setEditing: (w: Widget | Omit<Widget, "id">) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  uploading: boolean;
  onUploadBanner: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const info = TIPO_INFO[editing.tipo];

  function setConfig(patch: Record<string, any>) {
    setEditing({ ...editing, config: { ...editing.config, ...patch } });
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <info.icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">{info.label}</p>
          <p className="text-xs text-muted-foreground">{info.desc}</p>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
          Título do widget (opcional)
        </Label>
        <Input
          value={editing.titulo ?? ""}
          onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
          maxLength={80}
          placeholder={info.label}
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Onde aparece</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={editing.posicao === "esquerda" ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing({ ...editing, posicao: "esquerda" })}
          >
            Barra esquerda
          </Button>
          <Button
            type="button"
            variant={editing.posicao === "direita" ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing({ ...editing, posicao: "direita" })}
          >
            Barra direita
          </Button>
        </div>
      </div>

      {(editing.tipo === "imoveis_recentes" || editing.tipo === "blog_recente") && (
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Quantos itens mostrar
          </Label>
          <Input
            type="number"
            min={1}
            max={10}
            className="w-24"
            value={editing.config?.limite ?? 4}
            onChange={(e) => setConfig({ limite: Number(e.target.value) })}
          />
        </div>
      )}

      {editing.tipo === "banner_publicitario" && (
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Imagem do banner
            </Label>
            <div className="flex items-center gap-4">
              {editing.config?.imagem_url && (
                <img
                  src={editing.config.imagem_url}
                  alt=""
                  className="h-16 w-24 rounded-lg border border-border object-cover"
                />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando…" : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onUploadBanner}
                />
              </label>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Texto do banner
            </Label>
            <Input
              value={editing.config?.texto ?? ""}
              onChange={(e) => setConfig({ texto: e.target.value })}
              maxLength={100}
              placeholder="Ex: Confira nossos lançamentos exclusivos"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
              Link ao clicar (opcional)
            </Label>
            <Input
              value={editing.config?.link_url ?? ""}
              onChange={(e) => setConfig({ link_url: e.target.value })}
              maxLength={500}
              placeholder="https://…"
            />
          </div>
        </div>
      )}

      {editing.tipo === "texto_livre" && (
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Conteúdo</Label>
          <RichTextEditor
            value={editing.config?.conteudo_html ?? ""}
            onChange={(html) => setConfig({ conteudo_html: html })}
            placeholder="Escreva um aviso, selo de confiança, texto de destaque…"
            minHeight={140}
          />
        </div>
      )}

      {(editing.tipo === "contato" || editing.tipo === "redes_sociais") && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Este widget usa automaticamente as informações já cadastradas em{" "}
          <span className="font-medium text-foreground">Site → Site da imobiliária</span>.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar widget"}
        </Button>
      </div>
    </div>
  );
}
