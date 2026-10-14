import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { checkRateLimit, getClientIpFromRequest } from "@/lib/rateLimit";
import { ingestLandingLead } from "@/lib/landingLead.server";
import { FAIXAS_INVESTIMENTO, MORA_EM, PRAZO_COMPRA } from "@/lib/landingLeadOptions";

// Formulário das landings de campanha do próprio portal (/lp/*), acessadas só
// pelo anúncio. Sem auth (visitante anônimo) — por isso: honeypot, time-trap,
// rate limit por IP e lista fechada de landings válidas. A gravação é a mesma
// da landing externa mkt.imob365 (landingLead.server.ts): Tenant 0, sem
// corretor, dedupe 30 dias, e-mail pra LANDING_LEAD_NOTIFY_TO.

const LANDINGS = {
  // Leads desta landing vão para a conta pessoal do Bruno Ferraro (pedido do
  // usuário em 2026-10-14), já atribuídos a ele.
  "praia-grande": {
    fonte: "lp_praia_grande",
    fonteLabel: "LP Praia Grande",
    regiao: "Praia Grande",
    tenantSlug: "bruno-ferraro",
    corretorNome: "Bruno Ferraro",
  },
} as const;

const opt = (max: number) => z.string().trim().max(max).nullish();

const inputSchema = z.object({
  landing: z.enum(Object.keys(LANDINGS) as [keyof typeof LANDINGS]),
  // uuid gerado no navegador ao abrir a página — duplo clique/reenvio não duplica lead
  client_ref: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().max(30),
  email: z.string().trim().email().max(180),
  tipo_imovel: z.enum(["apartamento", "casa"]).default("apartamento"),
  faixa: z.enum(Object.keys(FAIXAS_INVESTIMENTO) as [keyof typeof FAIXAS_INVESTIMENTO]).nullish(),
  mora_em: z.enum(MORA_EM).nullish(),
  prazo: z.enum(PRAZO_COMPRA).nullish(),
  honeypot: opt(200),
  carregado_em: z.number().int().nullish(),
  utm_source: opt(100),
  utm_medium: opt(100),
  utm_campaign: opt(150),
  utm_content: opt(150),
  utm_term: opt(150),
  gclid: opt(200),
  fbclid: opt(200),
  pagina_origem: opt(300),
});

export const enviarLeadLanding = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; erro: string }> => {
    // Bot: responde sucesso "falso" (não ensina o bot a se adaptar) e não grava.
    if (data.honeypot) return { ok: true };
    if (data.carregado_em && Date.now() - data.carregado_em < 3000) return { ok: true };

    const request = getRequest();
    const ip = request ? getClientIpFromRequest(request) : "unknown";
    const rl = checkRateLimit(`lp-lead:${ip}`, { max: 5, windowMs: 10 * 60_000 });
    if (!rl.allowed) {
      return {
        ok: false,
        erro: "Muitos envios em pouco tempo. Tente novamente em alguns minutos.",
      };
    }

    let digitos = data.telefone.replace(/\D/g, "");
    if (digitos.length === 13 && digitos.startsWith("55")) digitos = digitos.slice(2);
    if (!/^[1-9]{2}9?\d{8}$/.test(digitos)) {
      return { ok: false, erro: "Telefone inválido — informe DDD + número." };
    }

    const landing = LANDINGS[data.landing];
    const faixa = data.faixa ? FAIXAS_INVESTIMENTO[data.faixa] : null;
    const extras: Record<string, string> = {};
    if (data.mora_em) extras["Mora em"] = data.mora_em;
    if (faixa) extras["Faixa de investimento"] = faixa.label;
    if (data.prazo) extras["Prazo para comprar"] = data.prazo;

    const r = await ingestLandingLead({
      external_ref: `lp:${data.landing}:${data.client_ref}`,
      fonte: landing.fonte,
      fonteLabel: landing.fonteLabel,
      tenantSlug: landing.tenantSlug,
      corretorNome: landing.corretorNome,
      nome: data.nome,
      telefone: digitos,
      email: data.email,
      tipo_imovel: data.tipo_imovel,
      operacao: "compra",
      bairro_regiao: landing.regiao,
      valor_investimento: faixa?.teto ?? null,
      extras,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      utm_term: data.utm_term,
      gclid: data.gclid,
      fbclid: data.fbclid,
      pagina_origem: data.pagina_origem,
      ip_origem: ip === "unknown" ? null : ip,
    });
    if (!r.ok) {
      return { ok: false, erro: "Não foi possível enviar agora. Fale com a gente pelo WhatsApp." };
    }
    return { ok: true };
  });
