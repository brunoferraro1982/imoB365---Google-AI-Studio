import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/format";
import type { ImovelFormData } from "@/components/imoveis/ImovelForm";
import { toast } from "sonner";

/**
 * Garante que exista uma linha em `imoveis` desde o início do cadastro (rascunho
 * mínimo, criado silenciosamente ao abrir a tela), pra permitir upload de fotos
 * antes de qualquer campo do formulário ser preenchido. Reaproveitado tanto pela
 * tela clássica (/app/imoveis/novo) quanto pelo wizard (/app/imoveis/assistente).
 */
export function useImovelDraft(tenantId: string | null | undefined, userId: string | undefined) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUserSaved, setHasUserSaved] = useState(false);
  const ensuring = useRef(false);

  useEffect(() => {
    if (!tenantId || !userId || savedId || ensuring.current) return;
    ensuring.current = true;
    (async () => {
      const slug = `rascunho-${Date.now().toString(36)}`;
      const { data: inserted, error } = await supabase
        .from("imoveis")
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          titulo: "Novo imóvel (rascunho)",
          slug,
        } as any)
        .select("id")
        .single();
      ensuring.current = false;
      if (error) {
        toast.error("Erro ao iniciar o cadastro: " + error.message);
        return;
      }
      setSavedId(inserted!.id);
    })();
  }, [tenantId, userId, savedId]);

  async function save(data: ImovelFormData, action: "save" | "publish" | "unpublish" = "save") {
    if (!savedId) {
      toast.error("Aguarde a inicialização do cadastro e tente novamente.");
      return;
    }
    setSaving(true);
    const slug = data.slug || slugify(data.titulo);
    const { error } = await supabase
      .from("imoveis")
      .update({
        ...data,
        finalidade: data.finalidade as "venda" | "aluguel" | "temporada",
        tipo: data.tipo as never,
        status: data.status as never,
        slug,
        publicado_em: data.publicado ? new Date().toISOString() : null,
      } as any)
      .eq("id", savedId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setHasUserSaved(true);
    toast.success(action === "publish" ? "Imóvel publicado no site" : "Imóvel salvo");
  }

  return { savedId, saving, hasUserSaved, save };
}
