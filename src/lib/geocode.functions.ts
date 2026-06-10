import { createServerFn } from "@tanstack/react-start";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = (data.query || "").trim();
    if (q.length < 5) return { ok: false as const, error: "Endereço muito curto" };
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "imob365/1.0 (geocode)" } });
    if (!res.ok) return { ok: false as const, error: "Falha no geocoding" };
    const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!arr.length) return { ok: false as const, error: "Endereço não encontrado" };
    return {
      ok: true as const,
      lat: parseFloat(arr[0].lat),
      lon: parseFloat(arr[0].lon),
      display_name: arr[0].display_name,
    };
  });
