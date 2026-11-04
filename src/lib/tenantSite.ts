import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";

// Carregamento comum do site público do tenant (/site/$slug e rotas filhas):
// tenant + configurações publicadas + páginas + presença de blog/lançamentos
// + CRECI. Antes cada rota repetia essa busca à mão.
export type SiteSettingsRow = SiteCtx["settings"] & Record<string, unknown>;

export async function carregarSiteCtx(
  slug: string,
  opts: { preview?: boolean; authTenantId?: string | null } = {},
): Promise<SiteCtx | null> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,slug,nome,tema,tipo_tenant,creci_juridico")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return null;

  // A prévia (/app/site/previa) só ignora o filtro de publicado quando o
  // próprio membro do tenant está olhando o seu site — a policy RLS
  // `site_settings_members_read` já cobre esse acesso.
  const isOwnTenantPreview = !!opts.preview && opts.authTenantId === tenant.id;
  let settingsQuery = supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenant.id);
  if (!isOwnTenantPreview) settingsQuery = settingsQuery.eq("publicado", true);

  const [
    { data: cfg },
    { data: pages },
    { count: blogCount },
    { count: empCount },
    { data: corretor },
  ] = await Promise.all([
    settingsQuery.maybeSingle(),
    supabase
      .from("tenant_pages")
      .select("slug,titulo")
      .eq("tenant_id", tenant.id)
      .eq("publicada", true)
      .order("ordem"),
    supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "publicado"),
    supabase
      .from("empreendimentos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("publicado", true),
    // CRECI pessoal do corretor autônomo (cadastro em /app/corretores).
    supabase
      .from("corretores")
      .select("creci,creci_uf")
      .eq("tenant_id", tenant.id)
      .not("creci", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!cfg) return null;

  const tipoTenant = (tenant as { tipo_tenant?: string | null }).tipo_tenant ?? null;
  const creciPessoal = corretor?.creci
    ? `${corretor.creci}${corretor.creci_uf ? `-${corretor.creci_uf}` : ""}`
    : null;
  const creciJuridico = (tenant as { creci_juridico?: string | null }).creci_juridico ?? null;

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantNome: tenant.nome,
    logoUrl: (tenant.tema as { logo_url?: string } | null)?.logo_url,
    tipoTenant,
    creci: tipoTenant === "corretor" ? creciPessoal || creciJuridico : creciJuridico || null,
    settings: cfg as SiteSettingsRow,
    pages: (pages ?? []) as { slug: string; titulo: string }[],
    hasBlog: (blogCount ?? 0) > 0,
    hasSobre: !!cfg.sobre_html?.trim(),
    empreendimentosTotal: empCount ?? 0,
  };
}

export function waHref(ctx: SiteCtx, texto?: string): string | null {
  const num = ctx.settings.contato_whatsapp?.replace(/\D/g, "");
  if (!num) return null;
  const n = num.length <= 11 ? `55${num}` : num;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** (11) 98888-7777 enquanto digita. */
export function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Título e meta description reais do site (o head da rota só conhece o
 * slug, porque os dados são carregados no cliente). `pagina` vira prefixo
 * nas rotas filhas ("Lançamentos — Bruno Ferraro").
 */
export function useTituloSite(ctx: SiteCtx | null, pagina?: string) {
  useEffect(() => {
    if (!ctx) return;
    document.title = pagina ? `${pagina} — ${ctx.tenantNome}` : `${ctx.tenantNome} — Imóveis`;
    const desc = ctx.settings.meta_description || ctx.settings.hero_subtitulo;
    if (desc) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "description";
        document.head.appendChild(tag);
      }
      tag.content = desc;
    }
  }, [ctx, pagina]);
}
