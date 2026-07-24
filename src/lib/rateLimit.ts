// Achado de segurança (Baixo) da auditoria de 2026-07-24: feeds públicos
// (portais, sitemap) e a API pública v1 não tinham nenhum rate limit,
// abrindo risco de scraping/abuso. Limiter simples em memória por
// chave (IP, ou IP+recurso) — reinicia a cada deploy/restart do processo,
// suficiente para conter abuso casual num único processo Node; não substitui
// um limiter distribuído (ex. Cloudflare/Redis) caso a app rode multi-instância.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= opts.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** IP real da requisição via headers do proxy nginx (X-Real-IP/X-Forwarded-For). */
export function getClientIpFromRequest(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 64);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim().slice(0, 64);
  return "unknown";
}
