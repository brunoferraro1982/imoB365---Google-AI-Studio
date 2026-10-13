import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";
import { checkRateLimit, getClientIpFromRequest } from "@/lib/rateLimit";
import { formatBRL } from "@/lib/format";
import { sendTenantEmail } from "@/lib/tenantSmtp.server";

// Webhook server-to-server da landing page externa (mkt.imob365.com.br,
// PHP+MySQL na hospedagem compartilhada). O submit-lead.php grava primeiro
// no MySQL dele (fonte da verdade/buffer) e depois envia pra cá; se falhar,
// o cron sync-pendentes.php reenvia — por isso tudo aqui é idempotente por
// `external_ref` ("mkt:<id da linha no MySQL>").
//
// Os leads entram SEMPRE no Tenant 0 (imoB365), sem corretor (rodízio
// desligado por decisão de produto) — o aviso vai por e-mail pra uma lista
// fixa (LANDING_LEAD_NOTIFY_TO), pelo SMTP do próprio Tenant 0.
//
// Autenticação: X-Signature: sha256=<HMAC-SHA256 do corpo cru> com
// LANDING_LEAD_SECRET. Falha FECHADA: sem secret configurado, nada entra.

const MAX_SKEW_MS = 10 * 60 * 1000;
const DEDUPE_DIAS = 30;

const payloadSchema = z.object({
  external_ref: z.string().trim().min(1).max(80),
  enviado_em: z.number().int(),
  backfill: z.boolean().optional().default(false),
  nome: z.string().trim().min(2).max(120),
  telefone: z
    .string()
    .trim()
    .regex(/^\d{10,13}$/),
  email: z.string().trim().email().max(180),
  tipo_imovel: z.enum(["casa", "apartamento", "outros"]),
  operacao: z.enum(["compra", "locacao"]),
  bairro_regiao: z.string().trim().max(150).nullish(),
  valor_investimento: z.number().nonnegative().nullish(),
  utm_source: z.string().max(100).nullish(),
  utm_medium: z.string().max(100).nullish(),
  utm_campaign: z.string().max(150).nullish(),
  utm_content: z.string().max(150).nullish(),
  utm_term: z.string().max(150).nullish(),
  gclid: z.string().max(200).nullish(),
  fbclid: z.string().max(200).nullish(),
  pagina_origem: z.string().max(300).nullish(),
  ip_origem: z.string().max(64).nullish(),
  criado_em: z.string().max(40).nullish(),
});
type LandingLead = z.infer<typeof payloadSchema>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.slice("sha256=".length), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Mesma normalização do trigger leads_set_dedupe_hashes (só dígitos /
// lower+trim) — senão o hash calculado aqui nunca bate com o gravado.
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function escape(s: string | null | undefined) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const TIPO_LABEL = { casa: "Casa", apartamento: "Apartamento", outros: "Outros" } as const;
const OPERACAO_LABEL = { compra: "Compra", locacao: "Locação" } as const;

function resumoInteresse(l: LandingLead) {
  return [
    OPERACAO_LABEL[l.operacao],
    TIPO_LABEL[l.tipo_imovel],
    l.bairro_regiao || null,
    l.valor_investimento ? `até ${formatBRL(l.valor_investimento)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function telefoneFormatado(d: string) {
  const n = d.length > 11 ? d.slice(-11) : d;
  return n.length === 11
    ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
    : `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
}

function emailHtml(l: LandingLead, opts: { link: string; voltou: boolean }) {
  const waDigits = l.telefone.length <= 11 ? `55${l.telefone}` : l.telefone;
  const campanha = [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ");
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${rotulo}</td><td style="padding:6px 0">${valor}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${opts.voltou ? "Lead voltou a entrar em contato" : "Novo lead da landing page"}</h2>
    <p style="margin:0 0 16px;color:#555">${escape(resumoInteresse(l))}</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${linha("Nome", `<strong>${escape(l.nome)}</strong>`)}
      ${linha("WhatsApp", `<a href="https://wa.me/${escape(waDigits)}">${escape(telefoneFormatado(l.telefone))}</a>`)}
      ${linha("E-mail", `<a href="mailto:${escape(l.email)}">${escape(l.email)}</a>`)}
      ${campanha ? linha("Campanha", escape(campanha)) : ""}
      ${l.gclid ? linha("Origem", "Google Ads (gclid)") : l.fbclid ? linha("Origem", "Meta Ads (fbclid)") : ""}
    </table>
    <p style="text-align:center;margin:24px 0">
      <a href="${escape(opts.link)}" style="display:inline-block;background:#FF7A1A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Abrir lead no CRM</a>
    </p>
    <p style="font-size:12px;color:#888">Lead sem corretor atribuído — distribua pela tela do lead.</p>
  </div>`;
}

async function notificar(tenantId: string, l: LandingLead, leadId: string, voltou: boolean) {
  const destinatarios = (process.env.LANDING_LEAD_NOTIFY_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (destinatarios.length === 0) {
    return { enviado: false as const, motivo: "LANDING_LEAD_NOTIFY_TO não configurado" };
  }
  const base = (process.env.APP_URL ?? "https://portal.imob365.com.br").replace(/\/$/, "");
  const link = `${base}/app/leads/${leadId}`;
  const prefixo = voltou ? "Lead voltou" : "Novo lead";
  const r = await sendTenantEmail(tenantId, {
    to: destinatarios,
    replyTo: l.email,
    subject: `${prefixo}: ${l.nome} — ${resumoInteresse(l)}`,
    text: `${prefixo} da landing page\n\n${l.nome}\n${telefoneFormatado(l.telefone)}\n${l.email}\n${resumoInteresse(l)}\n\n${link}`,
    html: emailHtml(l, { link, voltou }),
  });
  if (!r.enviado) console.error("[landing-lead] e-mail não enviado:", r.motivo);
  return r;
}

export const Route = createFileRoute("/api/public/webhooks/landing-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LANDING_LEAD_SECRET;
        if (!secret) return json(503, { error: "Integração não configurada" });

        const rl = checkRateLimit(`landing-lead:${getClientIpFromRequest(request)}`, {
          max: 60,
          windowMs: 60_000,
        });
        if (!rl.allowed) return json(429, { error: "Too Many Requests" });

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-signature"), secret)) {
          return json(401, { error: "Assinatura inválida" });
        }

        let lead: LandingLead;
        try {
          lead = payloadSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          const detalhe = err instanceof z.ZodError ? err.issues.map((i) => i.path.join(".")) : [];
          return json(400, { error: "Payload inválido", campos: detalhe });
        }
        if (Math.abs(Date.now() - lead.enviado_em) > MAX_SKEW_MS) {
          return json(401, { error: "Requisição expirada" });
        }

        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id")
          .eq("slug", CORPORATE_TENANT_SLUG)
          .maybeSingle();
        if (!tenant) return json(500, { error: "Tenant imoB365 não encontrado" });
        const tenantId = tenant.id;

        // 1. Idempotência — reenvio do mesmo lead (cron de pendentes)
        const { data: jaCriado } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_ref", lead.external_ref)
          .maybeSingle();
        if (jaCriado) return json(200, { ok: true, lead_id: jaCriado.id, duplicado: true });

        const { data: jaJuntado } = await supabaseAdmin
          .from("lead_interacoes")
          .select("lead_id")
          .eq("tenant_id", tenantId)
          .eq("metadata->>external_ref", lead.external_ref)
          .limit(1)
          .maybeSingle();
        if (jaJuntado) return json(200, { ok: true, lead_id: jaJuntado.lead_id, duplicado: true });

        const metadata = {
          fonte: "landing_page",
          external_ref: lead.external_ref,
          tipo_imovel: lead.tipo_imovel,
          operacao: lead.operacao,
          bairro_regiao: lead.bairro_regiao ?? null,
          valor_investimento: lead.valor_investimento ?? null,
          utm_source: lead.utm_source ?? null,
          utm_medium: lead.utm_medium ?? null,
          utm_campaign: lead.utm_campaign ?? null,
          utm_content: lead.utm_content ?? null,
          utm_term: lead.utm_term ?? null,
          gclid: lead.gclid ?? null,
          fbclid: lead.fbclid ?? null,
          pagina_origem: lead.pagina_origem ?? null,
          criado_em_origem: lead.criado_em ?? null,
          backfill: lead.backfill,
        };

        // 2. Mesma pessoa nos últimos 30 dias → junta no lead existente.
        //    O PHP já tira o "55" do telefone; testa as duas formas porque
        //    leads de outras origens podem ter sido gravados com DDI.
        const digitos = lead.telefone.replace(/\D/g, "");
        const local = digitos.length > 11 ? digitos.slice(-11) : digitos;
        const telHashes = [sha256(local), sha256(`55${local}`)];
        const emailHash = sha256(lead.email.trim().toLowerCase());
        const desde = new Date(Date.now() - DEDUPE_DIAS * 86_400_000).toISOString();
        const { data: existente } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("tenant_id", tenantId)
          .gte("created_at", desde)
          .or(`telefone_hash.in.(${telHashes.join(",")}),email_hash.eq.${emailHash}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existente) {
          const { error } = await supabaseAdmin.from("lead_interacoes").insert({
            lead_id: existente.id,
            tenant_id: tenantId,
            tipo: "nota",
            conteudo: `Novo envio pela landing page: ${resumoInteresse(lead)}`,
            metadata,
          });
          if (error) return json(500, { error: "Falha ao registrar interação" });
          await supabaseAdmin
            .from("leads")
            .update({ last_contact_at: new Date().toISOString() })
            .eq("id", existente.id);
          const email = lead.backfill ? null : await notificar(tenantId, lead, existente.id, true);
          return json(200, {
            ok: true,
            lead_id: existente.id,
            juntado: true,
            email_enviado: email?.enviado ?? false,
          });
        }

        // 3. Lead novo, sem corretor (rodízio desligado pra landing page)
        const { data: criado, error } = await supabaseAdmin
          .from("leads")
          .insert({
            tenant_id: tenantId,
            nome: lead.nome,
            telefone: local,
            email: lead.email,
            mensagem: resumoInteresse(lead),
            origem: "landing_page",
            status: "novo",
            utm_source: lead.utm_source ?? null,
            utm_medium: lead.utm_medium ?? null,
            utm_campaign: lead.utm_campaign ?? null,
            utm_content: lead.utm_content ?? null,
            utm_term: lead.utm_term ?? null,
            referrer: lead.pagina_origem ?? null,
            ip_origem: lead.ip_origem ?? null,
            gclid: lead.gclid ?? null,
            fbclid: lead.fbclid ?? null,
            external_ref: lead.external_ref,
          })
          .select("id")
          .single();
        if (error || !criado) {
          // Corrida entre envio direto e cron: o índice único segurou.
          if (error?.code === "23505") {
            const { data: outro } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("external_ref", lead.external_ref)
              .maybeSingle();
            return json(200, { ok: true, lead_id: outro?.id ?? null, duplicado: true });
          }
          console.error("[landing-lead] insert falhou:", error?.message);
          return json(500, { error: "Falha ao gravar lead" });
        }

        await supabaseAdmin.from("lead_interacoes").insert({
          lead_id: criado.id,
          tenant_id: tenantId,
          tipo: "nota",
          conteudo: `Lead recebido pela landing page: ${resumoInteresse(lead)}`,
          metadata,
        });

        const email = lead.backfill ? null : await notificar(tenantId, lead, criado.id, false);
        return json(201, { ok: true, lead_id: criado.id, email_enviado: email?.enviado ?? false });
      },
    },
  },
});
