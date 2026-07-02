import { supabase } from "@/integrations/supabase/client";

// Tenant 0 — a própria imobiliária imoB365, dona do site/blog institucional
// (imoB365 — Plataforma imobiliária all-in-one) servido em /, /blog etc.
// Resolvido por slug em vez de UUID fixo para não depender do ID exato do
// tenant em cada ambiente (dev/staging/produção).
export const CORPORATE_TENANT_SLUG = "imob365";

export async function getCorporateTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", CORPORATE_TENANT_SLUG)
    .maybeSingle();
  return data?.id ?? null;
}
