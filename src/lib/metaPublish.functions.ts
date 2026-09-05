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

async function graphGet(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`);
  Object.entries({ ...params, access_token: token }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Falha ao consultar (${path})`);
  }
  return json;
}

// Containers de mídia do Instagram (imagem, Story ou item de carrossel)
// processam de forma assíncrona do lado da Meta — chamar media_publish
// antes do status virar FINISHED retorna "Media ID is not available".
// Achado real em produção (Story do Instagram, 2026-09-05; Facebook
// publicou na hora, Instagram não). Doc oficial da Instagram Content
// Publishing API recomenda checar status_code antes de publicar.
async function aguardarContainerPronto(containerId: string, token: string): Promise<void> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const { status_code } = await graphGet(containerId, token, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error("A Meta não conseguiu processar a imagem enviada.");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("A Meta demorou demais pra processar a imagem — tente novamente.");
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
  await aguardarContainerPronto(container.id, token);
  const publicado = await graphPost(`${igUserId}/media_publish`, token, {
    creation_id: container.id,
  });
  return publicado.id;
}

// Carrossel — só existe pra Post (feed), nunca Story (Story é sempre uma
// única mídia por natureza da própria Meta). A primeira URL é sempre a
// capa (já composta com o template pelo client, ver imageTemplates.ts);
// as demais são as fotos originais do imóvel, sem overlay.
async function publicarCarrosselFacebook(
  pageId: string,
  token: string,
  imageUrls: string[],
  legenda: string | null,
): Promise<string> {
  const fotos = await Promise.all(
    imageUrls.map((url) => graphPost(`${pageId}/photos`, token, { url, published: "false" })),
  );
  const body: Record<string, string> = {};
  fotos.forEach((f, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: f.id });
  });
  if (legenda) body.message = legenda;
  const post = await graphPost(`${pageId}/feed`, token, body);
  return post.id;
}

async function publicarCarrosselInstagram(
  igUserId: string,
  token: string,
  imageUrls: string[],
  legenda: string | null,
): Promise<string> {
  const filhos = await Promise.all(
    imageUrls.map(async (url) => {
      const filho = await graphPost(`${igUserId}/media`, token, {
        image_url: url,
        is_carousel_item: "true",
      });
      await aguardarContainerPronto(filho.id, token);
      return filho;
    }),
  );
  const container = await graphPost(`${igUserId}/media`, token, {
    media_type: "CAROUSEL",
    children: filhos.map((f) => f.id).join(","),
    ...(legenda ? { caption: legenda } : {}),
  });
  await aguardarContainerPronto(container.id, token);
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
  // Demais fotos do imóvel, sem overlay — carrossel. Só usado quando
  // tipo_post === "post" (Story não suporta carrossel). Instagram limita
  // carrossel a 10 itens no total; 9 aqui + a capa em media_public_url.
  media_extra_urls: z.array(z.string().url()).max(9).optional(),
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

    // Carrossel só faz sentido pra Post — Story é sempre uma mídia só.
    const carrossel =
      data.tipo_post === "post" && data.media_extra_urls && data.media_extra_urls.length > 0
        ? [data.media_public_url, ...data.media_extra_urls]
        : null;

    try {
      let externalId: string;
      if (data.rede === "facebook") {
        if (!conexao.page_id) throw new Error("Página do Facebook não conectada.");
        if (carrossel) {
          externalId = await publicarCarrosselFacebook(
            conexao.page_id,
            conexao.page_access_token,
            carrossel,
            data.legenda ?? null,
          );
        } else {
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
        }
      } else {
        if (!conexao.instagram_business_account_id) {
          throw new Error(
            "Conta profissional do Instagram não vinculada — veja o passo 3.1 em Portais → Facebook/Instagram.",
          );
        }
        externalId = carrossel
          ? await publicarCarrosselInstagram(
              conexao.instagram_business_account_id,
              conexao.page_access_token,
              carrossel,
              data.legenda ?? null,
            )
          : await publicarInstagram(
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
