import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarFavoritos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("favoritos")
      .select("id, imovel_id, pasta, created_at, imoveis:imovel_id (id, slug, titulo, finalidade, tipo, preco, quartos, banheiros, vagas, area_util, endereco_cidade, endereco_uf, endereco_bairro, imovel_fotos(storage_path, capa, ordem))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { favoritos: data ?? [] };
  });

export const listarFavoritoIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("favoritos")
      .select("imovel_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ids: (data ?? []).map((r: any) => r.imovel_id as string) };
  });

export const adicionarFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ imovel_id: z.string().uuid(), pasta: z.string().max(60).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("favoritos")
      .upsert({ user_id: userId, imovel_id: data.imovel_id, pasta: data.pasta ?? null }, { onConflict: "user_id,imovel_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ imovel_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("favoritos")
      .delete()
      .eq("user_id", userId)
      .eq("imovel_id", data.imovel_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });