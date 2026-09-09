import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook nativo do DocuSign (Connect) — configurado automaticamente no
// callback OAuth (api.public.docusign.oauth.callback.ts), diferente do
// webhook genérico e manual dos outros 4 provedores de assinatura
// (api.public.webhooks.assinatura.$provider.ts, que exige o próprio tenant
// colar a URL no painel do provedor). O DocuSign assina o corpo com
// HMAC-SHA256 em base64 (não hex, diferente do webhook genérico) no header
// X-DocuSign-Signature-1 — confirmado via documentação oficial de
// segurança do Connect.
//
// Formato do payload: não testado ainda contra uma entrega real do
// DocuSign Connect (só documentação de terceiros, sem uma amostra 100%
// verificada) — por isso a busca abaixo é tolerante, procurando
// recursivamente por qualquer objeto com clientUserId+status em vez de
// assumir um caminho fixo. Se o formato real divergir, o payload bruto é
// logado pra ajuste posterior.

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verificarAssinaturaDocusign(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return timingSafeEqualStr(expected, header);
}

type RecipienteEvento = { clientUserId: string; status: string };

// Varre o payload procurando qualquer objeto com clientUserId+status,
// aceitando as duas convenções de nome de campo (camelCase da API REST
// nativa vs PascalCase da conversão legada de XML/aXML do Connect).
function extrairEventosRecipiente(
  payload: unknown,
  acc: RecipienteEvento[] = [],
): RecipienteEvento[] {
  if (!payload || typeof payload !== "object") return acc;
  const obj = payload as Record<string, unknown>;
  const clientUserId = obj.clientUserId ?? obj.ClientUserId;
  const status = obj.status ?? obj.Status;
  if (typeof clientUserId === "string" && typeof status === "string") {
    acc.push({ clientUserId, status: status.toLowerCase() });
  }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) value.forEach((v) => extrairEventosRecipiente(v, acc));
    else if (value && typeof value === "object") extrairEventosRecipiente(value, acc);
  }
  return acc;
}

const STATUS_MAP: Record<string, string> = {
  completed: "assinado",
  signed: "assinado",
  sent: "enviado",
  delivered: "enviado",
};

export const Route = createFileRoute("/api/public/webhooks/docusign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const tenantId = url.searchParams.get("tenant_id");
        if (!tenantId) {
          return Response.json({ error: "tenant_id ausente na URL" }, { status: 400 });
        }

        const { data: conexao } = await (supabaseAdmin as any)
          .from("tenant_docusign_connections")
          .select("connect_secret")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        const rawBody = await request.text();

        if (conexao?.connect_secret) {
          const valido = await verificarAssinaturaDocusign(
            rawBody,
            request.headers.get("x-docusign-signature-1"),
            conexao.connect_secret,
          );
          if (!valido) {
            return Response.json({ error: "Assinatura inválida" }, { status: 401 });
          }
        }

        let payload: unknown;
        try {
          payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          console.error("[webhook-docusign] payload não é JSON válido", rawBody.slice(0, 500));
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const eventos = extrairEventosRecipiente(payload);
        if (eventos.length === 0) {
          console.error(
            "[webhook-docusign] nenhum evento de recipiente reconhecido no payload",
            JSON.stringify(payload).slice(0, 1000),
          );
        }

        let atualizados = 0;
        for (const evento of eventos) {
          const novoStatus = STATUS_MAP[evento.status];
          if (!novoStatus) continue;
          const { error } = await (supabaseAdmin as any)
            .from("contrato_partes")
            .update({ assinatura_status: novoStatus })
            .eq("tenant_id", tenantId)
            .eq("id", evento.clientUserId);
          if (!error) atualizados++;
        }

        // contratos.assinatura_status é recalculado automaticamente pelo
        // trigger tg_contrato_partes_derivar_assinatura — nada a fazer aqui.
        return Response.json({ ok: true, eventos: eventos.length, atualizados });
      },
    },
  },
});
