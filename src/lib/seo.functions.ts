import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { invalidateSeoCache, DEFAULT_SEO_GLOBAL, type SeoGlobal } from "@/lib/seo";

// Server functions do /admin/seo (Fase 2). Todas gated a super_admin (mesmo
// padrão de admin.functions.ts: has_role via RPC, checado inline). Escrevem em
// seo_pages / global_settings(seo_global) — seo_pages ainda não está em
// types.ts, então cast (as any) nas queries — e invalidam o cache em memória do
// getSeoConfig pra o efeito aparecer no próximo SSR sem esperar o TTL.

// Texto curto e trim; string vazia vira null (= "usa o default do código").
const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .transform((s) => (s.length ? s : null))
    .nullable()
    .optional()
    .transform((s) => s ?? null);

export const listSeoPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const [pagesRes, globalRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("seo_pages")
        .select("id,path,title,description,canonical,noindex,og_image,updated_at")
        .order("path"),
      supabaseAdmin.from("global_settings").select("value").eq("key", "seo_global").maybeSingle(),
    ]);

    const rawGlobal = (globalRes.data?.value ?? {}) as Partial<SeoGlobal>;
    const global: SeoGlobal = {
      brand_name: rawGlobal.brand_name || DEFAULT_SEO_GLOBAL.brand_name,
      default_og_image: rawGlobal.default_og_image ?? DEFAULT_SEO_GLOBAL.default_og_image,
      search_action_target:
        rawGlobal.search_action_target || DEFAULT_SEO_GLOBAL.search_action_target,
      gsc_verification: rawGlobal.gsc_verification ?? DEFAULT_SEO_GLOBAL.gsc_verification,
      org: { ...DEFAULT_SEO_GLOBAL.org, ...(rawGlobal.org ?? {}) },
    };

    return { pages: pagesRes.data ?? [], global };
  });

export const saveSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      path: z.string().trim().min(1).max(200).regex(/^\//, "O caminho deve começar com /"),
      title: nullableText(180),
      description: nullableText(320),
      canonical: nullableText(300),
      og_image: nullableText(400),
      noindex: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const { error } = await (supabaseAdmin as any).from("seo_pages").upsert(
      {
        path: data.path,
        title: data.title,
        description: data.description,
        canonical: data.canonical,
        og_image: data.og_image,
        noindex: data.noindex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "path" },
    );
    if (error) throw new Error(error.message);

    invalidateSeoCache();
    return { ok: true };
  });

export const deleteSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ path: z.string().trim().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const { error } = await (supabaseAdmin as any).from("seo_pages").delete().eq("path", data.path);
    if (error) throw new Error(error.message);

    invalidateSeoCache();
    return { ok: true };
  });

export const saveSeoGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      default_og_image: z.string().trim().max(400).default(""),
      search_action_target: z.string().trim().max(400).default(""),
      gsc_verification: z.string().trim().max(200).default(""),
      org_description: z.string().trim().max(320).default(""),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const value: SeoGlobal = {
      brand_name: DEFAULT_SEO_GLOBAL.brand_name,
      default_og_image: data.default_og_image,
      search_action_target: data.search_action_target || DEFAULT_SEO_GLOBAL.search_action_target,
      gsc_verification: data.gsc_verification,
      org: { ...DEFAULT_SEO_GLOBAL.org, description: data.org_description },
    };

    const { error } = await (supabaseAdmin as any)
      .from("global_settings")
      .upsert({ key: "seo_global", value }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    invalidateSeoCache();
    return { ok: true };
  });
