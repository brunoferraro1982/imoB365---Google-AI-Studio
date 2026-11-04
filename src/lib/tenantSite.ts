import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import type { ImovelCard } from "@/components/site/sections/ImoveisSection";
import type { EmpreendimentoCard } from "@/components/site/sections/EmpreendimentosSection";
import { imovelFotoUrl } from "@/lib/format";

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

// ---------------------------------------------------------------------------
// Cache (React Query) do site do tenant: ao navegar entre Início, Imóveis,
// Lançamentos e Sobre, o contexto e as listas já carregadas são reaproveitados
// na hora — antes cada rota remontava, mostrava o esqueleto e refazia 3
// rodadas de consultas. Os links do header ainda pré-carregam no hover.
// ---------------------------------------------------------------------------
const STALE = 5 * 60_000;

const chaveCtx = (slug: string, previewTenant: string | null = null) =>
  ["site-ctx", slug, previewTenant] as const;

export function useSiteCtx(
  slug: string,
  opts: { preview?: boolean; authTenantId?: string | null } = {},
) {
  const previewTenant = opts.preview && opts.authTenantId ? opts.authTenantId : null;
  return useQuery({
    queryKey: chaveCtx(slug, previewTenant),
    queryFn: () => carregarSiteCtx(slug, opts),
    staleTime: previewTenant ? 0 : STALE,
  });
}

/** Contexto do site via cache (para rotas que ainda carregam dados em useEffect). */
export function obterSiteCtx(qc: QueryClient, slug: string) {
  return qc.fetchQuery({
    queryKey: chaveCtx(slug),
    queryFn: () => carregarSiteCtx(slug),
    staleTime: STALE,
  });
}

const COLS_IMOVEL =
  "id,slug,titulo,tipo,finalidade,preco,quartos,banheiros,vagas,area_util,endereco_bairro,endereco_cidade";

export type ImoveisSite = {
  imoveis: ImovelCard[];
  total: number;
  fotosMap: Record<string, string>;
};

export async function carregarImoveisSite(tenantId: string, limite?: number): Promise<ImoveisSite> {
  let q = supabase
    .from("imoveis")
    .select(COLS_IMOVEL, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("publicado", true)
    .eq("status", "ativo")
    .order("destaque", { ascending: false })
    .order("publicado_em", { ascending: false });
  if (limite) q = q.limit(limite);
  const { data, count } = await q;
  const imoveis = (data as ImovelCard[]) ?? [];
  const fotosMap: Record<string, string> = {};
  if (imoveis.length) {
    const { data: fotos } = await supabase
      .from("imovel_fotos")
      .select("imovel_id,storage_path,capa,ordem")
      .in(
        "imovel_id",
        imoveis.map((i) => i.id),
      )
      .order("capa", { ascending: false })
      .order("ordem");
    (fotos ?? []).forEach((f) => {
      if (!fotosMap[f.imovel_id]) fotosMap[f.imovel_id] = imovelFotoUrl(f.storage_path);
    });
  }
  return { imoveis, total: count ?? imoveis.length, fotosMap };
}

const chaveImoveis = (tenantId: string | undefined, limite?: number) =>
  ["site-imoveis", tenantId, limite ?? "todos"] as const;

export function useImoveisSite(tenantId: string | undefined, limite?: number) {
  return useQuery({
    queryKey: chaveImoveis(tenantId, limite),
    queryFn: () => carregarImoveisSite(tenantId!, limite),
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

export async function carregarEmpreendimentosSite(
  tenantId: string,
  limite?: number,
): Promise<EmpreendimentoCard[]> {
  let q = supabase
    .from("empreendimentos")
    .select(
      "id,slug,nome,fase,construtora,endereco_bairro,endereco_cidade,entrega_prevista,fotos_urls",
    )
    .eq("tenant_id", tenantId)
    .eq("publicado", true)
    .order("created_at", { ascending: false });
  if (limite) q = q.limit(limite);
  const { data } = await q;
  return (data as EmpreendimentoCard[]) ?? [];
}

const chaveEmp = (tenantId: string | undefined, limite?: number) =>
  ["site-emp", tenantId, limite ?? "todos"] as const;

export function useEmpreendimentosSite(tenantId: string | undefined, limite?: number) {
  return useQuery({
    queryKey: chaveEmp(tenantId, limite),
    queryFn: () => carregarEmpreendimentosSite(tenantId!, limite),
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

/** Quantos imóveis/lançamentos a home do site mostra (o resto fica em "Ver todos"). */
export const LIMITE_HOME_IMOVEIS = 12;
export const LIMITE_HOME_EMP = 6;

export type PaginaSite = "inicio" | "imoveis" | "lancamentos";

/** Pré-carrega os dados de uma página do site (hover nos links do header). */
export function usePrefetchSite(ctx: SiteCtx) {
  const qc = useQueryClient();
  return (pagina: PaginaSite) => {
    const t = ctx.tenantId;
    if (pagina === "inicio") {
      void qc.prefetchQuery({
        queryKey: chaveImoveis(t, LIMITE_HOME_IMOVEIS),
        queryFn: () => carregarImoveisSite(t, LIMITE_HOME_IMOVEIS),
        staleTime: STALE,
      });
      if ((ctx.empreendimentosTotal ?? 0) > 0)
        void qc.prefetchQuery({
          queryKey: chaveEmp(t, LIMITE_HOME_EMP),
          queryFn: () => carregarEmpreendimentosSite(t, LIMITE_HOME_EMP),
          staleTime: STALE,
        });
    } else if (pagina === "imoveis") {
      void qc.prefetchQuery({
        queryKey: chaveImoveis(t),
        queryFn: () => carregarImoveisSite(t),
        staleTime: STALE,
      });
    } else {
      void qc.prefetchQuery({
        queryKey: chaveEmp(t),
        queryFn: () => carregarEmpreendimentosSite(t),
        staleTime: STALE,
      });
    }
  };
}
