import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getValidDocusignAccessToken } from "@/lib/docusignOAuth.functions";

// Envio real de envelope pro DocuSign — primeira integração de assinatura
// eletrônica deste projeto que de fato chama a API de um provedor (as
// outras 4 opções de tenant_assinatura_config nunca chamaram nada real,
// "Solicitar assinatura" só gravava um UUID aleatório). O PDF em si
// continua sendo gerado no client, reaproveitando o mesmo mecanismo já
// real e testado de app.contratos.$id_.imprimir.tsx (html2canvas-pro +
// jsPDF a partir do modelo de contrato já interpolado) — não duplicado
// aqui, só recebido em base64.
//
// Limitação conhecida e documentada: o posicionamento da tag de assinatura
// usa anchorString (procura o texto "Assinatura:" no PDF) com
// anchorIgnoreIfNotPresent — se o modelo de contrato do tenant não tiver
// esse texto literal, o envelope ainda é enviado, mas sem tag de
// assinatura posicionada automaticamente (o signatário precisa ter "Free
// Form Signing" habilitado na conta DocuSign do tenant pra assinar mesmo
// assim). Corrigir isso de verdade exigiria um editor de posicionamento de
// tag, fora do escopo desta integração BYO.

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

const enviarSchema = z.object({
  parteId: z.string().uuid(),
  pdfBase64: z.string().min(1),
  nomeArquivo: z.string().trim().min(1).max(200),
});

export const enviarParaAssinaturaDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => enviarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; envelopeId: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

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
      throw new Error("Sem permissão para enviar contratos pra assinatura.");

    const { data: parte } = await (supabaseAdmin as any)
      .from("contrato_partes")
      .select("id,nome,email,tenant_id")
      .eq("id", data.parteId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!parte) throw new Error("Parte não encontrada.");
    if (!parte.email) {
      throw new Error(
        "Esta parte não tem e-mail cadastrado — obrigatório pro DocuSign enviar o convite de assinatura.",
      );
    }

    const { accessToken, accountId, baseUri } = await getValidDocusignAccessToken(tenantId);

    const envelopeBody = {
      emailSubject: `Assinatura eletrônica — ${parte.nome}`,
      documents: [
        {
          documentBase64: data.pdfBase64,
          name: data.nomeArquivo,
          fileExtension: "pdf",
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          {
            email: parte.email,
            name: parte.nome,
            recipientId: "1",
            routingOrder: "1",
            // clientUserId = id da própria parte — é isso que o webhook
            // (api.public.webhooks.docusign.ts) usa pra saber qual
            // contrato_partes atualizar quando o DocuSign notifica que foi
            // assinado, sem precisar de um segundo campo de referência.
            clientUserId: parte.id,
            tabs: {
              signHereTabs: [
                {
                  anchorString: "Assinatura:",
                  anchorUnits: "pixels",
                  anchorXOffset: "0",
                  anchorYOffset: "-10",
                  anchorIgnoreIfNotPresent: "true",
                  anchorCaseSensitive: "false",
                },
              ],
            },
          },
        ],
      },
      status: "sent",
    };

    const res = await fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(envelopeBody),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.envelopeId) {
      throw new Error(json?.message ?? `Falha ao enviar envelope pro DocuSign (${res.status})`);
    }

    const { error } = await (supabaseAdmin as any)
      .from("contrato_partes")
      .update({ assinatura_status: "enviado", assinatura_referencia_externa: json.envelopeId })
      .eq("id", parte.id);
    if (error) throw new Error(error.message);

    return { ok: true, envelopeId: json.envelopeId };
  });
