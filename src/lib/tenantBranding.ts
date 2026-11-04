import { supabase } from "@/integrations/supabase/client";

// Bucket/caminho/limite compartilhados pelos 3 pontos de upload da imagem de
// marca do tenant (assistente de site, seção Marca, conta/perfil) — pra
// corretor autônomo essa mesma imagem é uma foto pessoal em vez de um logo
// de empresa, mas a fonte (tenants.tema.logo_url) é sempre a mesma.
// `opts` permite o mesmo upload para a foto de capa do hero do site
// (/app/site), que costuma ser maior que um logo.
export async function uploadTenantBrandingImage(
  tenantId: string,
  file: File,
  opts: { prefixo?: string; maxMB?: number } = {},
): Promise<string> {
  const maxMB = opts.maxMB ?? 2;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`A imagem deve ter no máximo ${maxMB}MB`);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${tenantId}/${opts.prefixo ?? "logo"}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("tenant-branding")
    .upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from("tenant-branding").getPublicUrl(path);
  return pub.publicUrl;
}
