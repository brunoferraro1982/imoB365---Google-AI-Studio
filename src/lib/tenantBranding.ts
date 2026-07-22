import { supabase } from "@/integrations/supabase/client";

// Bucket/caminho/limite compartilhados pelos 3 pontos de upload da imagem de
// marca do tenant (assistente de site, seção Marca, conta/perfil) — pra
// corretor autônomo essa mesma imagem é uma foto pessoal em vez de um logo
// de empresa, mas a fonte (tenants.tema.logo_url) é sempre a mesma.
export async function uploadTenantBrandingImage(tenantId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 2MB");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${tenantId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("tenant-branding")
    .upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from("tenant-branding").getPublicUrl(path);
  return pub.publicUrl;
}
