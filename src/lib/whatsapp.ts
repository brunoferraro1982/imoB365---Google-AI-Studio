/**
 * Helpers para WhatsApp click-to-chat (sem API/Twilio).
 * Gera deep links wa.me que abrem a conversa com mensagem pré-preenchida.
 */

/** Limpa um número e garante código do país (padrão 55 — Brasil). */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry = "55",
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith(defaultCountry)) return digits;
  // Se já tiver 12+ dígitos assume que já tem DDI
  if (digits.length >= 12) return digits;
  return defaultCountry + digits;
}

/** Gera um link wa.me?text=... pronto para abrir em nova aba. */
export function waLink(phone: string | null | undefined, message?: string): string | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  const base = `https://wa.me/${p}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Mensagem padrão para contato sobre um imóvel. */
export function imovelMessage(opts: { titulo: string; url?: string }): string {
  const linha1 = `Olá! Tenho interesse no imóvel "${opts.titulo}".`;
  const linha2 = opts.url ? `\n${opts.url}` : "";
  return `${linha1}${linha2}\nPode me passar mais informações?`;
}
