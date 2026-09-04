import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Publicação ATIVA de conteúdo (Post/Story) no Facebook/Instagram — segue o
// mesmo padrão de resolução de credencial por tenant já validado em
// produção no webhook de Lead Ads (api.public.webhooks.meta.ts): resolve
// tenant_id → busca page_access_token/instagram_business_account_id em
// tenant_meta_connections → chama a Graph API com esse token, nunca uma
// credencial global. Endpoints confirmados na documentação oficial da Meta
// (Instagram Content Publishing API / Page Photos / Page Stories API).

const META_GRAPH_VERSION = "v21.0";

async function graphPost(path: string, token: string, body: Record<string, string>): Promise<any> {
  const params = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, {
    method: "POST",
    body: params,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Falha ao publicar (${path})`);
  }
  return json;
}

async function publicarFotoFacebook(
  pageId: string,
  token: string,
  imageUrl: string,
  legenda: string | null,
): Promise<string> {
  const json = await graphPost(`${pageId}/photos`, token, {
    url: imageUrl,
    ...(legenda ? { caption: legenda } : {}),
  });
  return json.post_id ?? json.id;
}

async function publicarStoryFacebook(
  pageId: string,
  token: string,
  imageUrl: string,
): Promise<string> {
  // Story de Facebook Page usa um endpoint próprio (photo_stories), diferente
  // do de Instagram — precisa de uma foto já enviada (não publicada no feed).
  const foto = await graphPost(`${pageId}/photos`, token, { url: imageUrl, published: "false" });
  const story = await graphPost(`${pageId}/photo_stories`, token, { photo_id: foto.id });
  return story.post_id ?? story.id;
}

async function publicarInstagram(
  igUserId: string,
  token: string,
  imageUrl: string,
  tipoPost: "post" | "story",
  legenda: string | null,
): Promise<string> {
  const mediaParams: Record<string, string> = { image_url: imageUrl };
  if (tipoPost === "story") {
    mediaParams.media_type = "STORIES";
  } else if (legenda) {
    mediaParams.caption = legenda;
  }
  const container = await graphPost(`${igUserId}/media`, token, mediaParams);
  const publicado = await graphPost(`${igUserId}/media_publish`, token, {
    creation_id: container.id,
  });
  return publicado.id;
}

const publicarSchema = z.object({
  tenant_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
  rede: z.enum(["facebook", "instagram"]),
  tipo_post: z.enum(["post", "story"]),
  template_id: z.string().uuid().nullable().optional(),
  media_public_url: z.string().url(),
  legenda: z.string().max(2200).nullable().optional(),
});

export const publicarNasRedesSociais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => publicarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: isBroker }, { data: isSuper }] = await Promise.all([
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenant_id,
        _role: "admin",
      }),
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: data.tenant_id,
        _role: "broker",
      }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isBroker && !isSuper) {
      throw new Error("Sem permissão para publicar nas redes sociais desta imobiliária.");
    }

    const { data: conexao } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .select("page_id,page_access_token,instagram_business_account_id")
      .eq("tenant_id", data.tenant_id)
      .maybeSingle();
    if (!conexao?.page_access_token) {
      throw new Error(
        "Conecte sua Página do Facebook antes de publicar (Portais → Facebook/Instagram).",
      );
    }

    async function registrar(
      status: "publicado" | "erro",
      externalId: string | null,
      erro: string | null,
    ) {
      await (supabaseAdmin as any).from("imovel_social_posts").insert({
        tenant_id: data.tenant_id,
        imovel_id: data.imovel_id,
        rede: data.rede,
        tipo_post: data.tipo_post,
        template_id: data.template_id ?? null,
        legenda: data.legenda ?? null,
        media_public_url: data.media_public_url,
        external_post_id: externalId,
        status,
        erro_mensagem: erro,
        created_by: userId,
      });
    }

    try {
      let externalId: string;
      if (data.rede === "facebook") {
        if (!conexao.page_id) throw new Error("Página do Facebook não conectada.");
        externalId =
          data.tipo_post === "post"
            ? await publicarFotoFacebook(
                conexao.page_id,
                conexao.page_access_token,
                data.media_public_url,
                data.legenda ?? null,
              )
            : await publicarStoryFacebook(
                conexao.page_id,
                conexao.page_access_token,
                data.media_public_url,
              );
      } else {
        if (!conexao.instagram_business_account_id) {
          throw new Error(
            "Conta profissional do Instagram não vinculada — veja o passo 3.1 em Portais → Facebook/Instagram.",
          );
        }
        externalId = await publicarInstagram(
          conexao.instagram_business_account_id,
          conexao.page_access_token,
          data.media_public_url,
          data.tipo_post,
          data.legenda ?? null,
        );
      }
      await registrar("publicado", externalId, null);
      return { ok: true, externalId };
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao publicar";
      await registrar("erro", null, mensagem);
      throw new Error(mensagem);
    }
  });
