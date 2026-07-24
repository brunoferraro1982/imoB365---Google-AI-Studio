import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// Achado crítico da auditoria de segurança de 2026-07-24: conteúdo HTML de
// tenant (site institucional, páginas, widgets, blog) era gravado por
// escrita direta do client Supabase, sem nenhuma sanitização — um usuário
// com permissão de escrita (ou uma sessão comprometida) podia gravar HTML
// arbitrário direto pela API, pulando a UI do editor, e esse HTML é
// renderizado via dangerouslySetInnerHTML em páginas públicas do site do
// tenant. Estas server functions centralizam a sanitização (DOMPurify, ver
// sanitizeHtml.ts) no servidor, antes de qualquer INSERT/UPDATE — a UI
// (RichTextEditor) já só produz o HTML permitido, mas a sanitização aqui
// não confia nisso, trata qualquer entrada como potencialmente hostil.
// A autorização em si (quem pode escrever em qual tenant) continua sendo
// decidida pela RLS de cada tabela, sem mudança nenhuma — o cliente
// Supabase usado aqui roda com o JWT do usuário autenticado, não service role.

const siteSettingsSchema = z
  .object({
    tenant_id: z.string().uuid(),
    publicado: z.boolean(),
    hero_titulo: z.string().nullable().optional(),
    hero_subtitulo: z.string().nullable().optional(),
    hero_cta_label: z.string().nullable().optional(),
    sobre_html: z.string().nullable().optional(),
    contato_telefone: z.string().nullable().optional(),
    contato_whatsapp: z.string().nullable().optional(),
    contato_email: z.string().nullable().optional(),
    endereco: z.string().nullable().optional(),
    instagram_url: z.string().nullable().optional(),
    facebook_url: z.string().nullable().optional(),
    youtube_url: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    cor_destaque: z.string().nullable().optional(),
    meta_description: z.string().nullable().optional(),
    ga4_id: z.string().nullable().optional(),
    gtm_id: z.string().nullable().optional(),
    google_ads_id: z.string().nullable().optional(),
    fb_pixel_id: z.string().nullable().optional(),
    hotjar_id: z.string().nullable().optional(),
    layout: z.string().nullable().optional(),
    secoes: z.array(z.any()).optional(),
  })
  .passthrough();

export const saveTenantSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => siteSettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      ...data,
      sobre_html: data.sobre_html ? sanitizeHtml(data.sobre_html) : data.sobre_html,
    };
    const { error } = await supabase
      .from("tenant_site_settings")
      .upsert(payload as any, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const tenantPageSchema = z.object({
  tenant_id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  titulo: z.string().min(1).max(200),
  conteudo_html: z.string(),
  ordem: z.number().int(),
  publicada: z.boolean(),
});

export const saveTenantPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tenantPageSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = { ...data, conteudo_html: sanitizeHtml(data.conteudo_html) };
    const { error } = await supabase
      .from("tenant_pages")
      .upsert(payload, { onConflict: "tenant_id,slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const tenantWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  tipo: z.string(),
  posicao: z.string(),
  ordem: z.number().int(),
  titulo: z.string().nullable(),
  ativo: z.boolean(),
  config: z.record(z.string(), z.any()),
});

export const saveTenantWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tenantWidgetSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const config =
      typeof rest.config?.conteudo_html === "string"
        ? { ...rest.config, conteudo_html: sanitizeHtml(rest.config.conteudo_html) }
        : rest.config;
    const payload = { ...rest, config };
    const { error } = id
      ? await supabase.from("tenant_site_widgets").update(payload).eq("id", id)
      : await supabase.from("tenant_site_widgets").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const blogPostSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  titulo: z.string().min(1),
  slug: z.string().min(1),
  conteudo: z.string().nullable(),
  resumo: z.string().nullable(),
  imagem_url: z.string().nullable(),
  status: z.enum(["rascunho", "publicado"]),
  categoria: z.string().nullable(),
  autor_id: z.string().uuid().nullable(),
  seo_titulo: z.string().nullable(),
  seo_description: z.string().nullable(),
  seo_keywords: z.string().nullable(),
  publicado_em: z.string().nullable(),
});

export const saveBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => blogPostSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      conteudo: rest.conteudo ? sanitizeHtml(rest.conteudo) : rest.conteudo,
    };
    const { error } = id
      ? await supabase
          .from("blog_posts")
          .update(payload as any)
          .eq("id", id)
      : await supabase.from("blog_posts").insert(payload as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
