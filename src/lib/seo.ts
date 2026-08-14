import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Fase 2 do SEO: as rotas institucionais leem overrides editáveis (seo_pages)
// + config global (global_settings chave seo_global) pra montar o <head>, sem
// precisar de deploy a cada ajuste. O super admin edita em /admin/seo.
//
// getSeoConfig roda no loader do __root (isomórfico) — cache em memória com TTL
// curto (mesmo espírito de rateLimit.ts: SEO muda pouco, uma query a cada N s
// basta; reinicia a cada deploy/restart do processo). seoHead() mescla o
// default do código com o override do banco; readSeoFromMatches() puxa o config
// do loaderData do root dentro do head() de cada rota.

export const SITE_URL = "https://portal.imob365.com.br";

export type SeoPageOverride = {
  path: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  og_image: string | null;
};

export type SeoGlobal = {
  brand_name: string;
  default_og_image: string;
  search_action_target: string;
  /** Token de verificação do Google Search Console (meta google-site-verification). */
  gsc_verification: string;
  /** Measurement ID do Google Analytics 4 (ex.: G-XXXXXXXXXX). Vazio = GA desligado. */
  ga_measurement_id: string;
  /** data-key do Ahrefs Web Analytics — hoje SÓ referência/preparo: o script real
   * está fixo em __root.tsx (RootShell), este campo não aciona nada ainda. */
  ahrefs_analytics_key: string;
  org: { url: string; areaServed: string; description: string };
};

export type SeoConfig = {
  pages: Record<string, SeoPageOverride>;
  global: SeoGlobal;
};

export const DEFAULT_SEO_GLOBAL: SeoGlobal = {
  brand_name: "imob365",
  default_og_image: "",
  search_action_target: `${SITE_URL}/buscar?q={search_term_string}`,
  gsc_verification: "",
  ga_measurement_id: "",
  // Valor de referência pré-preenchido de propósito (não vazio) — o script já
  // está fixo no código, então o campo em /admin/seo nasce mostrando o mesmo
  // valor em uso, mesmo antes de qualquer save.
  ahrefs_analytics_key: "PSbPYvE9hFaWKmvrPzDhrg",
  org: { url: SITE_URL, areaServed: "BR", description: "" },
};

const EMPTY_CONFIG: SeoConfig = { pages: {}, global: DEFAULT_SEO_GLOBAL };

let cache: { data: SeoConfig; at: number } | null = null;
const TTL_MS = 60_000;

/** Zera o cache — chamado pelas server functions de escrita do /admin/seo pra
 * o efeito aparecer no próximo request sem esperar o TTL. */
export function invalidateSeoCache() {
  cache = null;
}

export const getSeoConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoConfig> => {
    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) return cache.data;

    try {
      // seo_pages ainda não está em types.ts (tabela nova) — cast (as any),
      // mesmo padrão já usado no projeto pra tabelas antes da regeneração.
      const [pagesRes, globalRes] = await Promise.all([
        (supabaseAdmin as any)
          .from("seo_pages")
          .select("path,title,description,canonical,noindex,og_image"),
        supabaseAdmin.from("global_settings").select("value").eq("key", "seo_global").maybeSingle(),
      ]);

      const pages: Record<string, SeoPageOverride> = {};
      for (const row of (pagesRes.data ?? []) as SeoPageOverride[]) {
        pages[row.path] = row;
      }

      const rawGlobal = (globalRes.data?.value ?? {}) as Partial<SeoGlobal>;
      const global: SeoGlobal = {
        brand_name: rawGlobal.brand_name || DEFAULT_SEO_GLOBAL.brand_name,
        default_og_image: rawGlobal.default_og_image || DEFAULT_SEO_GLOBAL.default_og_image,
        search_action_target:
          rawGlobal.search_action_target || DEFAULT_SEO_GLOBAL.search_action_target,
        gsc_verification: rawGlobal.gsc_verification || DEFAULT_SEO_GLOBAL.gsc_verification,
        ga_measurement_id: rawGlobal.ga_measurement_id || DEFAULT_SEO_GLOBAL.ga_measurement_id,
        // Presente no objeto por completude de tipo — NÃO é lido pelo head() do
        // root pra renderizar nada (o script do Ahrefs está fixo, ver RootShell).
        ahrefs_analytics_key:
          rawGlobal.ahrefs_analytics_key || DEFAULT_SEO_GLOBAL.ahrefs_analytics_key,
        org: { ...DEFAULT_SEO_GLOBAL.org, ...(rawGlobal.org ?? {}) },
      };

      const data: SeoConfig = { pages, global };
      cache = { data, at: now };
      return data;
    } catch {
      // Nunca deixa o SEO derrubar a home — degrada pro default do código.
      return cache?.data ?? EMPTY_CONFIG;
    }
  },
);

/** Lê o SeoConfig exposto pelo loader do __root a partir dos matches do head(). */
export function readSeoFromMatches(matches: Array<{ routeId?: string; loaderData?: unknown }>) {
  const root = matches.find((m) => m.routeId === "__root__");
  const seo = (root?.loaderData as { seo?: SeoConfig } | undefined)?.seo;
  return seo ?? EMPTY_CONFIG;
}

type MetaEntry = Record<string, unknown>;

/**
 * Mescla o default do código (título/description/imagem que a rota já tinha) com
 * o override editável do banco e devolve { meta, links } pronto pro head().
 * Campo vazio no banco = usa o default do código. canonical cai no auto-referente.
 */
export function seoHead(opts: {
  seo: SeoConfig;
  path: string;
  title: string;
  description: string;
  image?: string;
}): { meta: MetaEntry[]; links: MetaEntry[] } {
  const override = opts.seo.pages[opts.path];
  const global = opts.seo.global;

  const title = override?.title || opts.title;
  const description = override?.description || opts.description;
  const canonical = override?.canonical || `${SITE_URL}${opts.path === "/" ? "/" : opts.path}`;
  const ogImage = override?.og_image || opts.image || global.default_og_image;

  const meta: MetaEntry[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
  if (ogImage) meta.push({ property: "og:image", content: ogImage });
  if (override?.noindex) meta.push({ name: "robots", content: "noindex, follow" });

  return { meta, links: [{ rel: "canonical", href: canonical }] };
}
