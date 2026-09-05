import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Share2, Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMetaConnectionStatus } from "@/lib/metaOAuth.functions";
import { gerarPostRedesImovel } from "@/lib/ai.functions";
import { publicarNasRedesSociais } from "@/lib/metaPublish.functions";
import {
  renderPostImage,
  FEED_FORMATOS,
  STORY_FORMATO,
  type TipoPost,
  type FormatoFeed,
  type TemplateConfig,
} from "@/lib/imageTemplates";
import { formatBRL, imovelFotoUrl } from "@/lib/format";
import { toast } from "sonner";

type Foto = { id: string; storage_path: string };
type Template = { id: string; nome: string; tipo_post: TipoPost; config: TemplateConfig };

export function ImovelRedesSociaisSection({
  imovelId,
  tenantId,
}: {
  imovelId: string;
  tenantId: string | null | undefined;
}) {
  const fetchStatus = useServerFn(getMetaConnectionStatus);
  const fetchLegenda = useServerFn(gerarPostRedesImovel);
  const publicar = useServerFn(publicarNasRedesSociais);

  const [loading, setLoading] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [instagramConectado, setInstagramConectado] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [imovel, setImovel] = useState<Record<string, any> | null>(null);

  const [rede, setRede] = useState<"facebook" | "instagram" | "ambas">("facebook");
  const [tipoPost, setTipoPost] = useState<TipoPost>("post");
  const [formatoFeed, setFormatoFeed] = useState<FormatoFeed>("retrato");
  const [fotoId, setFotoId] = useState<string>("");
  const [incluirTodasFotos, setIncluirTodasFotos] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [legenda, setLegenda] = useState("");
  const [gerandoLegenda, setGerandoLegenda] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [
        status,
        { data: imo },
        { data: fts },
        { data: tpls },
        { data: tenant },
        { data: siteSettings },
      ] = await Promise.all([
        fetchStatus(),
        (supabase as any)
          .from("imoveis")
          .select(
            "titulo,preco,finalidade,tipo,quartos,suites,banheiros,vagas,area_util,endereco_bairro,endereco_cidade,caracteristicas",
          )
          .eq("id", imovelId)
          .maybeSingle(),
        (supabase as any)
          .from("imovel_fotos")
          .select("id,storage_path")
          .eq("imovel_id", imovelId)
          .order("capa", { ascending: false })
          .order("ordem"),
        (supabase as any)
          .from("social_post_templates")
          .select("id,nome,tipo_post,config")
          .eq("ativo", true)
          .order("ordem"),
        supabase.from("tenants").select("tema").eq("id", tenantId).maybeSingle(),
        (supabase as any)
          .from("tenant_site_settings")
          .select("cor_destaque")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);
      setConectado(status.connected);
      setInstagramConectado(status.instagramConnected);
      setImovel(imo ?? null);
      setFotos((fts as Foto[]) ?? []);
      setFotoId(fts?.[0]?.id ?? "");
      const tpl = (tpls as Template[]) ?? [];
      setTemplates(tpl);
      setTemplateId(tpl.find((t) => t.tipo_post === "post")?.id ?? "");
      setLogoUrl((tenant?.tema as { logo_url?: string } | null)?.logo_url ?? null);
      setAccentColor(siteSettings?.cor_destaque ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelId, tenantId]);

  const templatesDoTipo = useMemo(
    () => templates.filter((t) => t.tipo_post === tipoPost),
    [templates, tipoPost],
  );

  // Instagram limita carrossel a 10 itens no total (1 capa + 9 aqui) — o
  // Facebook não impõe um teto tão baixo, mas usamos o mesmo pra "Ambas"
  // sempre publicar o mesmo conjunto de fotos nas duas redes.
  const outrasFotosCount = Math.min(Math.max(fotos.length - 1, 0), 9);

  useEffect(() => {
    if (templatesDoTipo.length && !templatesDoTipo.some((t) => t.id === templateId)) {
      setTemplateId(templatesDoTipo[0].id);
    }
  }, [templatesDoTipo, templateId]);

  useEffect(() => {
    setPreviewUrl(null);
    setPreviewBlob(null);
  }, [rede, tipoPost, formatoFeed, fotoId, templateId, incluirTodasFotos]);

  // Carrossel só existe pra Post — Story é sempre uma mídia só na Meta.
  useEffect(() => {
    if (tipoPost === "story") setIncluirTodasFotos(false);
  }, [tipoPost]);

  async function gerarLegenda() {
    if (!imovel) return;
    setGerandoLegenda(true);
    try {
      const { post } = await fetchLegenda({
        data: {
          titulo: imovel.titulo ?? "",
          finalidade: imovel.finalidade ?? "venda",
          tipo: imovel.tipo ?? "apartamento",
          bairro: imovel.endereco_bairro ?? "",
          cidade: imovel.endereco_cidade ?? "",
          quartos: imovel.quartos ?? null,
          area_util: imovel.area_util ?? null,
          preco: imovel.preco ?? null,
          caracteristicas: (imovel.caracteristicas ?? []).join(", "),
        },
      });
      setLegenda(post);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar legenda");
    } finally {
      setGerandoLegenda(false);
    }
  }

  function specsLabel() {
    if (!imovel) return "";
    const partes = [
      imovel.quartos ? `${imovel.quartos} quartos` : null,
      imovel.vagas ? `${imovel.vagas} vagas` : null,
      imovel.area_util ? `${imovel.area_util}m²` : null,
    ].filter(Boolean);
    return partes.join(" · ");
  }

  function localLabel() {
    // Nunca logradouro/número — só bairro/cidade, mesmo padrão já usado
    // pelo gerador de legenda via IA (gerarPostRedesImovel/ImovelInput).
    if (!imovel) return "";
    return [imovel.endereco_bairro, imovel.endereco_cidade].filter(Boolean).join(", ");
  }

  async function gerarPreview() {
    const foto = fotos.find((f) => f.id === fotoId);
    const template = templates.find((t) => t.id === templateId);
    if (!foto || !template || !imovel) {
      toast.error("Selecione uma foto e um modelo.");
      return;
    }
    setGerandoPreview(true);
    try {
      const { width, height } = tipoPost === "post" ? FEED_FORMATOS[formatoFeed] : STORY_FORMATO;
      const blob = await renderPostImage({
        fotoUrl: imovelFotoUrl(foto.storage_path),
        logoUrl,
        accentColor,
        titulo: imovel.titulo ?? "",
        precoLabel: formatBRL(imovel.preco),
        specsLabel: specsLabel(),
        localLabel: localLabel(),
        width,
        height,
        config: template.config,
      });
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar a prévia");
    } finally {
      setGerandoPreview(false);
    }
  }

  async function publicarPost() {
    if (!previewBlob || !tenantId) {
      toast.error("Gere a prévia antes de publicar.");
      return;
    }
    setPublicando(true);
    try {
      // {tenant_id}/{imovel_id}/... — a policy de escrita do bucket
      // imovel-fotos casta o PRIMEIRO segmento da pasta pra uuid
      // (((storage.foldername(name))[1])::uuid) pra checar o tenant; um
      // prefixo textual antes do tenant_id (ex. "social-posts/...") quebra
      // esse cast com "invalid input syntax for type uuid" — achado real
      // em produção. Mesmo padrão já usado em ImovelFotosSection.tsx.
      const path = `${tenantId}/${imovelId}/social-posts/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("imovel-fotos")
        .upload(path, previewBlob, { cacheControl: "3600", contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);
      const mediaPublicUrl = imovelFotoUrl(path);

      // Demais fotos do imóvel (sem overlay) pro carrossel — já são
      // públicas no mesmo bucket, não precisa reenviar nada.
      // Instagram limita carrossel a 10 itens no total (1 capa + 9 aqui) —
      // mesmo teto validado no schema do servidor (metaPublish.functions.ts).
      const mediaExtraUrls =
        incluirTodasFotos && tipoPost === "post"
          ? fotos
              .filter((f) => f.id !== fotoId)
              .slice(0, 9)
              .map((f) => imovelFotoUrl(f.storage_path))
          : undefined;

      const redes: ("facebook" | "instagram")[] =
        rede === "ambas" ? ["facebook", "instagram"] : [rede];
      for (const r of redes) {
        await publicar({
          data: {
            tenant_id: tenantId,
            imovel_id: imovelId,
            rede: r,
            tipo_post: tipoPost,
            template_id: templateId || null,
            media_public_url: mediaPublicUrl,
            media_extra_urls: mediaExtraUrls,
            legenda: legenda || null,
          },
        });
      }
      toast.success("Publicado nas redes sociais!");
      setPreviewUrl(null);
      setPreviewBlob(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setPublicando(false);
    }
  }

  if (loading) return null;

  if (!conectado) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <Share2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Conecte sua Página do Facebook/Instagram para publicar este imóvel direto nas redes
          sociais.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/app/portais/meta">
            <ExternalLink className="mr-2 h-4 w-4" /> Conectar Facebook/Instagram
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Share2 className="h-5 w-5 text-primary" />
        Publicar nas redes sociais
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rede
          </Label>
          <Select value={rede} onValueChange={(v) => setRede(v as typeof rede)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram" disabled={!instagramConectado}>
                Instagram {!instagramConectado && "(não vinculado)"}
              </SelectItem>
              <SelectItem value="ambas" disabled={!instagramConectado}>
                Ambas
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tipo de post
          </Label>
          <Select value={tipoPost} onValueChange={(v) => setTipoPost(v as TipoPost)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="post">Post (feed)</SelectItem>
              <SelectItem value="story">Story</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tamanho
          </Label>
          {tipoPost === "post" ? (
            <Select value={formatoFeed} onValueChange={(v) => setFormatoFeed(v as FormatoFeed)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEED_FORMATOS).map(([key, f]) => (
                  <SelectItem key={key} value={key}>
                    {f.label} ({f.width}×{f.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
              {STORY_FORMATO.label} ({STORY_FORMATO.width}×{STORY_FORMATO.height}) — único formato
              aceito pela Meta pra Story
            </div>
          )}
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Foto
          </Label>
          <Select value={fotoId} onValueChange={setFotoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma foto" />
            </SelectTrigger>
            <SelectContent>
              {fotos.map((f, i) => (
                <SelectItem key={f.id} value={f.id}>
                  Foto {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modelo
          </Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {templatesDoTipo.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fotos.length > 1 &&
        (tipoPost === "post" ? (
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <Checkbox
              checked={incluirTodasFotos}
              onCheckedChange={(v) => setIncluirTodasFotos(v === true)}
            />
            <span>
              <span className="font-medium">Incluir todas as fotos do imóvel (carrossel)</span>
              <span className="block text-xs text-muted-foreground">
                A foto selecionada acima vira a capa com o modelo escolhido; as outras{" "}
                {outrasFotosCount} vão sem overlay, do jeito que estão publicadas no portal.
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Carrossel (várias fotos) só existe pra Post — Story é sempre uma única imagem na Meta.
          </p>
        ))}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Legenda
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={gerarLegenda}
            disabled={gerandoLegenda}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {gerandoLegenda ? "Gerando…" : "Gerar com IA"}
          </Button>
        </div>
        <Textarea rows={3} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <Button type="button" variant="outline" onClick={gerarPreview} disabled={gerandoPreview}>
          {gerandoPreview ? "Gerando…" : "Gerar prévia"}
        </Button>
        {previewUrl && (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Prévia do post"
              className="h-48 rounded-lg border border-border object-cover"
            />
            {incluirTodasFotos && fotos.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                +{outrasFotosCount} fotos no carrossel
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={publicarPost} disabled={!previewBlob || publicando}>
          {publicando ? "Publicando…" : "Publicar"}
        </Button>
      </div>
    </section>
  );
}
