import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";
import { formatBRL } from "@/lib/format";
import { sendTenantEmail } from "@/lib/tenantSmtp.server";

// Ingestão de leads de landing pages de campanha no CRM do Tenant 0
// (imoB365). Usado por:
//   - /api/public/webhooks/landing-lead — landing externa mkt.imob365.com.br
//     (PHP+MySQL na hospedagem compartilhada, assinada com HMAC);
//   - landingLead.functions.ts — landings internas do portal (/lp/*).
//
// Os leads entram sem corretor (rodízio desligado por decisão de produto) e
// o aviso vai por e-mail pra lista fixa LANDING_LEAD_NOTIFY_TO, pelo SMTP do
// próprio Tenant 0. Idempotente por `external_ref`; mesma pessoa (telefone/
// e-mail) em até 30 dias vira interação no lead existente.

const DEDUPE_DIAS = 30;

export const baseLeadSchema = z.object({
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

export type LandingLeadInput = z.infer<typeof baseLeadSchema> & {
  external_ref: string;
  backfill?: boolean;
  /** Identificador estável da landing (vai pro metadata), ex.: "mkt_imob365". */
  fonte: string;
  /** Nome legível da landing, usado no e-mail, ex.: "LP Praia Grande". */
  fonteLabel: string;
  /** Respostas extras do formulário (rótulo → valor), mostradas no e-mail e no CRM. */
  extras?: Record<string, string>;
};

export type LandingLeadResultado =
  | {
      ok: true;
      status: "criado" | "juntado" | "duplicado";
      leadId: string | null;
      emailEnviado: boolean;
    }
  | { ok: false; erro: string };

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

export function resumoInteresse(l: LandingLeadInput) {
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

function emailHtml(l: LandingLeadInput, opts: { link: string; voltou: boolean }) {
  const waDigits = l.telefone.length <= 11 ? `55${l.telefone}` : l.telefone;
  const campanha = [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ");
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${rotulo}</td><td style="padding:6px 0">${valor}</td></tr>`;
  const extras = Object.entries(l.extras ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => linha(escape(k), escape(v)))
    .join("");
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${opts.voltou ? "Lead voltou a entrar em contato" : "Novo lead"} — ${escape(l.fonteLabel)}</h2>
    <p style="margin:0 0 16px;color:#555">${escape(resumoInteresse(l))}</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${linha("Nome", `<strong>${escape(l.nome)}</strong>`)}
      ${linha("WhatsApp", `<a href="https://wa.me/${escape(waDigits)}">${escape(telefoneFormatado(l.telefone))}</a>`)}
      ${linha("E-mail", `<a href="mailto:${escape(l.email)}">${escape(l.email)}</a>`)}
      ${extras}
      ${campanha ? linha("Campanha", escape(campanha)) : ""}
      ${l.gclid ? linha("Origem", "Google Ads (gclid)") : l.fbclid ? linha("Origem", "Meta Ads (fbclid)") : ""}
    </table>
    <p style="text-align:center;margin:24px 0">
      <a href="${escape(opts.link)}" style="display:inline-block;background:#FF7A1A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Abrir lead no CRM</a>
    </p>
    <p style="font-size:12px;color:#888">Lead sem corretor atribuído — distribua pela tela do lead.</p>
  </div>`;
}

async function notificar(tenantId: string, l: LandingLeadInput, leadId: string, voltou: boolean) {
  const destinatarios = (process.env.LANDING_LEAD_NOTIFY_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (destinatarios.length === 0) {
    console.error("[landing-lead] e-mail não enviado: LANDING_LEAD_NOTIFY_TO não configurado");
    return false;
  }
  const base = (process.env.APP_URL ?? "https://portal.imob365.com.br").replace(/\/$/, "");
  const link = `${base}/app/leads/${leadId}`;
  const prefixo = voltou ? "Lead voltou" : "Novo lead";
  const extrasTexto = Object.entries(l.extras ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const r = await sendTenantEmail(tenantId, {
    to: destinatarios,
    replyTo: l.email,
    subject: `${prefixo} (${l.fonteLabel}): ${l.nome} — ${resumoInteresse(l)}`,
    text: `${prefixo} — ${l.fonteLabel}\n\n${l.nome}\n${telefoneFormatado(l.telefone)}\n${l.email}\n${resumoInteresse(l)}\n${extrasTexto}\n\n${link}`,
    html: emailHtml(l, { link, voltou }),
  });
  if (!r.enviado) console.error("[landing-lead] e-mail não enviado:", r.motivo);
  return r.enviado;
}

export async function ingestLandingLead(lead: LandingLeadInput): Promise<LandingLeadResultado> {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", CORPORATE_TENANT_SLUG)
    .maybeSingle();
  if (!tenant) return { ok: false, erro: "Tenant imoB365 não encontrado" };
  const tenantId = tenant.id;

  // 1. Idempotência — reenvio do mesmo lead (cron de pendentes, duplo clique)
  const { data: jaCriado } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_ref", lead.external_ref)
    .maybeSingle();
  if (jaCriado) return { ok: true, status: "duplicado", leadId: jaCriado.id, emailEnviado: false };

  const { data: jaJuntado } = await supabaseAdmin
    .from("lead_interacoes")
    .select("lead_id")
    .eq("tenant_id", tenantId)
    .eq("metadata->>external_ref", lead.external_ref)
    .limit(1)
    .maybeSingle();
  if (jaJuntado) {
    return { ok: true, status: "duplicado", leadId: jaJuntado.lead_id, emailEnviado: false };
  }

  const metadata = {
    fonte: lead.fonte,
    external_ref: lead.external_ref,
    tipo_imovel: lead.tipo_imovel,
    operacao: lead.operacao,
    bairro_regiao: lead.bairro_regiao ?? null,
    valor_investimento: lead.valor_investimento ?? null,
    extras: lead.extras ?? {},
    utm_source: lead.utm_source ?? null,
    utm_medium: lead.utm_medium ?? null,
    utm_campaign: lead.utm_campaign ?? null,
    utm_content: lead.utm_content ?? null,
    utm_term: lead.utm_term ?? null,
    gclid: lead.gclid ?? null,
    fbclid: lead.fbclid ?? null,
    pagina_origem: lead.pagina_origem ?? null,
    criado_em_origem: lead.criado_em ?? null,
    backfill: lead.backfill ?? false,
  };
  const extrasNota = Object.entries(lead.extras ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  const nota = (prefixo: string) =>
    `${prefixo} (${lead.fonteLabel}): ${resumoInteresse(lead)}${extrasNota ? ` · ${extrasNota}` : ""}`;

  // 2. Mesma pessoa nos últimos 30 dias → junta no lead existente.
  //    Testa com e sem DDI porque leads de outras origens podem ter sido
  //    gravados com "55" na frente.
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
      conteudo: nota("Novo envio"),
      metadata,
    });
    if (error) return { ok: false, erro: "Falha ao registrar interação" };
    await supabaseAdmin
      .from("leads")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", existente.id);
    const emailEnviado = lead.backfill
      ? false
      : await notificar(tenantId, lead, existente.id, true);
    return { ok: true, status: "juntado", leadId: existente.id, emailEnviado };
  }

  // 3. Lead novo, sem corretor
  const { data: criado, error } = await supabaseAdmin
    .from("leads")
    .insert({
      tenant_id: tenantId,
      nome: lead.nome,
      telefone: local,
      email: lead.email,
      mensagem: [resumoInteresse(lead), extrasNota].filter(Boolean).join(" · "),
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
    // Corrida entre dois envios do mesmo ref: o índice único segurou.
    if (error?.code === "23505") {
      const { data: outro } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("external_ref", lead.external_ref)
        .maybeSingle();
      return { ok: true, status: "duplicado", leadId: outro?.id ?? null, emailEnviado: false };
    }
    console.error("[landing-lead] insert falhou:", error?.message);
    return { ok: false, erro: "Falha ao gravar lead" };
  }

  await supabaseAdmin.from("lead_interacoes").insert({
    lead_id: criado.id,
    tenant_id: tenantId,
    tipo: "nota",
    conteudo: nota("Lead recebido"),
    metadata,
  });

  const emailEnviado = lead.backfill ? false : await notificar(tenantId, lead, criado.id, false);
  return { ok: true, status: "criado", leadId: criado.id, emailEnviado };
}
