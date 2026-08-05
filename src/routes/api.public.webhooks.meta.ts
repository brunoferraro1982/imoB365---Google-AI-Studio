import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META_GRAPH_VERSION = "v21.0";

// Webhook de Lead Ads da Meta (Fase 3 da integração Facebook/Instagram — ver
// src/lib/metaOAuth.functions.ts pra conexão e
// api.public.feeds.$tenantSlug.meta-catalog.csv.ts pro catálogo). Diferente
// do Marketplace (sem API pública, scraping proibido — ver changelog), Lead
// Ads é um mecanismo 100% oficial da própria Meta: o tenant roda campanhas
// reais no Ads Manager usando o catálogo publicado, e a Meta nos avisa aqui
// quando alguém preenche o formulário de um anúncio.
//
// Verificação da assinatura: X-Hub-Signature-256: sha256=<hmac hex>, HMAC
// sobre o corpo CRU da requisição, chave META_APP_SECRET (mesma chave do
// Meta App único registrado pelo imoB365 — não é por tenant).
function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type MetaLeadgenChange = {
  field: string;
  value?: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    created_time?: number;
  };
};

async function processarLeadgenEvent(leadgenId: string, pageId: string) {
  // resolve tenant pela conexão salva (page_id -> tenant_id) — o payload do
  // webhook não carrega tenant nenhum, só ids da própria Meta.
  const { data: conexao } = await (supabaseAdmin as any)
    .from("tenant_meta_connections")
    .select("tenant_id,page_access_token")
    .eq("page_id", pageId)
    .maybeSingle();
  if (!conexao) {
    return {
      erro: `Nenhuma conexão encontrada pra page_id ${pageId}`,
      tenantId: null,
      leadId: null,
    };
  }

  // o payload do webhook só traz o id do lead, não as respostas do
  // formulário — precisa buscar os dados de verdade na Graph API.
  const leadRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?access_token=${encodeURIComponent(conexao.page_access_token)}`,
  );
  const leadBody = await leadRes.json().catch(() => null);
  if (!leadRes.ok || !leadBody) {
    return {
      erro: `Falha ao buscar dados do lead na Graph API: ${JSON.stringify(leadBody)}`,
      tenantId: conexao.tenant_id,
      leadId: null,
    };
  }

  const campos: Record<string, string> = {};
  for (const f of leadBody.field_data ?? []) {
    campos[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
  }

  const { data: lead, error: leadErr } = await supabaseAdmin
    .from("leads")
    .insert({
      tenant_id: conexao.tenant_id,
      nome: campos.full_name || campos.first_name || "Lead do Facebook",
      email: campos.email || null,
      telefone: campos.phone_number || null,
      origem: "meta_leads",
      mensagem: `Lead gerado via campanha no Facebook/Instagram (form ${leadBody.form_id ?? "—"}).`,
    } as any)
    .select("id")
    .single();
  if (leadErr) {
    return { erro: leadErr.message, tenantId: conexao.tenant_id, leadId: null };
  }

  return { erro: null, tenantId: conexao.tenant_id, leadId: (lead as any).id as string };
}

export const Route = createFileRoute("/api/public/webhooks/meta")({
  server: {
    handlers: {
      // Desafio de verificação exigido pela Meta antes de aceitar registrar
      // a URL do webhook no painel do app — sem equivalente no webhook do
      // Mercado Pago.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const secret = process.env.META_APP_SECRET;
        if (!secret) {
          console.error("META_APP_SECRET não configurada");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        const valid = verifySignature(rawBody, request.headers.get("x-hub-signature-256"), secret);
        if (!valid) {
          console.error("Assinatura inválida no webhook da Meta");
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Corpo inválido" }, { status: 400 });
        }

        const resultados: { leadgenId: string; duplicate?: boolean; erro?: string | null }[] = [];

        for (const entry of payload?.entry ?? []) {
          for (const change of (entry.changes ?? []) as MetaLeadgenChange[]) {
            if (change.field !== "leadgen") continue;
            const leadgenId = change.value?.leadgen_id;
            const pageId = change.value?.page_id ?? entry.id;
            if (!leadgenId || !pageId) continue;

            // Idempotência: grava ANTES de processar. Reenvio da mesma
            // notificação (23505) responde 200 sem reprocessar.
            const { error: insertError } = await supabaseAdmin
              .from("meta_leadgen_events" as any)
              .insert({
                leadgen_id: leadgenId,
                page_id: pageId,
                raw_payload: change.value,
              } as any);
            if (insertError) {
              if ((insertError as any).code === "23505") {
                resultados.push({ leadgenId, duplicate: true });
                continue;
              }
              console.error("Erro ao gravar meta_leadgen_events", insertError);
              resultados.push({ leadgenId, erro: insertError.message });
              continue;
            }

            try {
              const r = await processarLeadgenEvent(leadgenId, pageId);
              await (supabaseAdmin as any)
                .from("meta_leadgen_events")
                .update({
                  processed_at: new Date().toISOString(),
                  tenant_id: r.tenantId,
                  lead_id: r.leadId,
                  error: r.erro,
                })
                .eq("leadgen_id", leadgenId);
              resultados.push({ leadgenId, erro: r.erro });
            } catch (err: any) {
              console.error("Erro ao processar leadgen event", err);
              await (supabaseAdmin as any)
                .from("meta_leadgen_events")
                .update({
                  processed_at: new Date().toISOString(),
                  error: String(err?.message ?? err),
                })
                .eq("leadgen_id", leadgenId);
              resultados.push({ leadgenId, erro: String(err?.message ?? err) });
            }
          }
        }

        return Response.json({ ok: true, resultados });
      },
    },
  },
});
