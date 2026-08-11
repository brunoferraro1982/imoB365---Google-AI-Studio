import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { VisitorRegion } from "@/lib/featuredImoveis";

// Região aproximada do visitante, lida dos headers que o nginx (módulo GeoIP2)
// injeta a partir do IP — X-Geo-City / X-Geo-Region (UF) / X-Geo-Country. O IP
// nunca sai do servidor (decisão de privacidade). Mesmo mecanismo de leitura
// de header já usado em ai.functions.ts (getRequest()).
//
// Degrada graciosamente: se os headers não existem (dev local, ou antes do
// GeoIP2 estar configurado na VPS) ou o país não é BR, retorna null e a home
// compõe a vitrine sem o sinal de região. Sem auth — a home é pública.

function limpar(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().slice(0, 120);
  return s.length ? s : null;
}

export const getVisitorRegion = createServerFn({ method: "GET" }).handler(
  async (): Promise<VisitorRegion> => {
    const request = getRequest();
    if (!request) return null;

    const country = limpar(request.headers.get("x-geo-country"));
    // Só personaliza por região dentro do Brasil — UF/cidade de fora não
    // casam com endereco_uf/endereco_cidade dos imóveis.
    if (country && country.toUpperCase() !== "BR") return null;

    const city = limpar(request.headers.get("x-geo-city"));
    const uf = limpar(request.headers.get("x-geo-region"));
    if (!city && !uf) return null;

    return { city, uf, country: country ?? "BR" };
  },
);
