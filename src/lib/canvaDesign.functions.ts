import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getValidCanvaAccessToken, base64urlDecode } from "@/lib/canvaOAuth.functions";

// Fluxo "Editar no Canva" — a Canva não permite embutir o próprio editor
// num iframe (nenhuma integração de terceiro tem esse recurso, é sempre
// redirecionamento), então o fluxo real é "Return Navigation": criamos o
// design a partir da imagem que a imob365 já compôs (renderPostImage, ver
// imageTemplates.ts) → o corretor edita numa aba nova, no editor de
// verdade da Canva → ele clica em "Voltar" lá dentro → a Canva devolve o
// navegador pra cá com o design_id → exportamos e trazemos a imagem final
// de volta pro bucket próprio (nunca hotlinka). Endpoints confirmados na
// documentação oficial da Canva Connect API (Asset Uploads / Designs /
// Exports).

const CANVA_API = "https://api.canva.com/rest/v1";

async function canvaFetch(path: string, token: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${CANVA_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      json?.message ?? json?.error?.message ?? `Falha na Canva (${path}): ${res.status}`,
    );
  }
  return json;
}

// Uploads de asset e exports são jobs assíncronos na Canva — mesmo padrão
// de polling já usado pro Instagram em metaPublish.functions.ts
// (aguardarContainerPronto), só que aqui é a própria resposta do job que
// carrega o resultado final quando status vira "success".
async function aguardarJob(path: string, token: string, extrairResultado: (job: any) => any) {
  for (let tentativa = 0; tentativa < 15; tentativa++) {
    const { job } = await canvaFetch(path, token);
    if (job.status === "success") return extrairResultado(job);
    if (job.status === "failed") {
      throw new Error(job.error?.message ?? "A Canva não conseguiu processar o job.");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("A Canva demorou demais pra processar — tente novamente.");
}

async function uploadAssetNaCanva(token: string, imageBlob: ArrayBuffer, nomeArquivo: string) {
  const nomeBase64 = btoa(unescape(encodeURIComponent(nomeArquivo)));
  const { job } = await canvaFetch("/asset-uploads", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: nomeBase64 }),
    },
    body: imageBlob,
  });
  return aguardarJob(`/asset-uploads/${job.id}`, token, (j) => j.asset.id);
}

async function resolverTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

const iniciarEdicaoSchema = z.object({
  imovelId: z.string().uuid(),
  mediaPublicUrl: z.string().url(),
  width: z.number().int().min(40).max(8000),
  height: z.number().int().min(40).max(8000),
});

// Ponto de entrada — chamado pelo botão "Editar no Canva" em
// ImovelRedesSociaisSection.tsx, DEPOIS que o corretor já gerou a prévia
// (a mesma imagem que seria publicada direto vira o ponto de partida na
// Canva, em vez de o corretor começar do zero).
export const iniciarEdicaoNoCanva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => iniciarEdicaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ editUrl: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolverTenantId(supabase, userId);

    const [{ data: isAdmin }, { data: isBroker }] = await Promise.all([
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: tenantId,
        _role: "admin",
      }),
      supabase.rpc("has_role_in_tenant", {
        _user_id: userId,
        _tenant_id: tenantId,
        _role: "broker",
      }),
    ]);
    if (!isAdmin && !isBroker)
      throw new Error("Sem permissão para editar imagens desta imobiliária.");

    const token = await getValidCanvaAccessToken(tenantId);

    const imgRes = await fetch(data.mediaPublicUrl);
    if (!imgRes.ok) throw new Error("Não foi possível carregar a imagem gerada.");
    const imageBlob = await imgRes.arrayBuffer();

    const assetId = await uploadAssetNaCanva(token, imageBlob, `imovel-${data.imovelId}.jpg`);

    const { design } = await canvaFetch("/designs", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "type_and_asset",
        design_type: { type: "custom", width: data.width, height: data.height },
        asset_id: assetId,
        title: `imob365 — imóvel ${data.imovelId}`,
      }),
    });

    await (supabaseAdmin as any).from("imovel_canva_designs").insert({
      tenant_id: tenantId,
      imovel_id: data.imovelId,
      design_id: design.id,
      edit_url: design.urls.edit_url,
      status: "editando",
      created_by: userId,
    });

    // A Canva devolve o navegador pro nosso "Return URL" (fixo, registrado
    // uma vez nas configurações da integração — ver wizard) só depois que
    // o corretor clica em "Voltar" DENTRO do próprio editor. Pra saber
    // qual design voltou, anexamos um correlation_state na própria
    // edit_url — a Canva embute esse valor de volta dentro de um JWT
    // (correlation_jwt) que ela mesma assina, junto com o design_id real
    // (mais confiável que confiar só no nosso correlation_state).
    const editUrlComEstado = new URL(design.urls.edit_url);
    editUrlComEstado.searchParams.set("correlation_state", design.id);

    return { editUrl: editUrlComEstado.toString() };
  });

// Decodifica (sem verificar assinatura) o `correlation_jwt` que a Canva
// anexa ao redirecionar de volta pro nosso Return URL. Não verificamos a
// assinatura da Canva aqui de propósito: o `design_id` extraído só é
// aceito abaixo se já existir uma linha em imovel_canva_designs pra ESSE
// tenant com ESSE design_id (criada por nós mesmos em
// iniciarEdicaoNoCanva) — um JWT forjado com um design_id de outro tenant
// nunca encontraria essa linha, então não há vetor real de vazamento
// entre tenants mesmo sem a verificação criptográfica completa.
function decodificarCorrelationJwt(jwt: string): { designId: string } {
  const partes = jwt.split(".");
  if (partes.length !== 3) throw new Error("correlation_jwt em formato inválido.");
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(partes[1])));
  if (!payload?.design_id) throw new Error("correlation_jwt sem design_id.");
  return { designId: payload.design_id };
}

const finalizarEdicaoSchema = z.object({ correlationJwt: z.string().min(1) });

// Chamado pela rota de retorno (depois que o corretor clica em "Voltar"
// dentro da própria Canva) — exporta o design e traz a imagem final pro
// bucket imovel-fotos, nunca hotlinkando a URL de export da Canva (que
// além de tudo expira em 24h).
export const finalizarEdicaoNoCanva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => finalizarEdicaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ mediaPublicUrl: string; imovelId: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolverTenantId(supabase, userId);
    const { designId } = decodificarCorrelationJwt(data.correlationJwt);

    const { data: registro } = await (supabaseAdmin as any)
      .from("imovel_canva_designs")
      .select("id,imovel_id,design_id")
      .eq("design_id", designId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!registro) throw new Error("Design não encontrado — a edição pode ter expirado.");

    const token = await getValidCanvaAccessToken(tenantId);

    try {
      const { job } = await canvaFetch("/exports", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_id: designId,
          format: { type: "jpg", quality: 90 },
        }),
      });
      const downloadUrl: string = await aguardarJob(`/exports/${job.id}`, token, (j) => j.urls[0]);

      const imgRes = await fetch(downloadUrl);
      if (!imgRes.ok) throw new Error("Falha ao baixar a imagem exportada da Canva.");
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const path = `${tenantId}/${registro.imovel_id}/social-posts/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("imovel-fotos")
        .upload(path, buf, { cacheControl: "3600", contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("imovel-fotos").getPublicUrl(path);

      await (supabaseAdmin as any)
        .from("imovel_canva_designs")
        .update({ status: "exportado", media_public_url: pub.publicUrl })
        .eq("id", registro.id);

      return { mediaPublicUrl: pub.publicUrl, imovelId: registro.imovel_id };
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao exportar";
      await (supabaseAdmin as any)
        .from("imovel_canva_designs")
        .update({ status: "erro", erro_mensagem: mensagem })
        .eq("id", registro.id);
      throw new Error(mensagem);
    }
  });
