import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron endpoint: scans saved searches with alerta_email=true and sends a digest email
// with new published properties since the last digest. Auth: Supabase anon key in `apikey` header.

const MAX_ITEMS_PER_EMAIL = 8;

function applyFilters(q: any, f: Record<string, any>) {
  if (f.finalidade && f.finalidade !== "todos") q = q.eq("finalidade", f.finalidade);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  const n = (v: any) => Number(v) || 0;
  if (n(f.quartos) > 0) q = q.gte("quartos", n(f.quartos));
  if (n(f.banheiros) > 0) q = q.gte("banheiros", n(f.banheiros));
  if (n(f.vagas) > 0) q = q.gte("vagas", n(f.vagas));
  if (n(f.areaMin) > 0) q = q.gte("area_util", n(f.areaMin));
  if (n(f.precoMin) > 0) q = q.gte("preco", n(f.precoMin));
  if (n(f.precoMax) > 0) q = q.lte("preco", n(f.precoMax));
  if (f.bairro) q = q.ilike("endereco_bairro", `%${f.bairro}%`);
  return q;
}

function renderEmail(nomeBusca: string, items: any[], siteOrigin: string) {
  const cards = items.slice(0, MAX_ITEMS_PER_EMAIL).map((i) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:8px 0">
      <a href="${siteOrigin}/imovel/${i.slug}" style="color:#0f172a;text-decoration:none">
        <div style="font-weight:600;font-size:15px">${escapeHtml(i.titulo)}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px">
          ${escapeHtml([i.endereco_bairro, i.endereco_cidade && `${i.endereco_cidade}/${i.endereco_uf ?? ""}`].filter(Boolean).join(" · "))}
        </div>
        <div style="color:#2563eb;font-weight:700;margin-top:6px">${formatBRL(i.preco)}</div>
      </a>
    </div>`).join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Novos imóveis para "${escapeHtml(nomeBusca)}"</h2>
      <p style="color:#64748b;margin:0 0 16px">Encontramos ${items.length} novo${items.length === 1 ? "" : "s"} imóvel${items.length === 1 ? "" : "is"} que combinam com sua busca salva.</p>
      ${cards}
      <p style="margin-top:16px"><a href="${siteOrigin}/minhas-buscas" style="color:#2563eb">Gerenciar minhas buscas</a></p>
      <p style="font-size:11px;color:#94a3b8;margin-top:24px">imob365 — você está recebendo este e-mail porque ativou alertas em uma busca salva.</p>
    </div>`;
}

function escapeHtml(s: string) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function formatBRL(v: number | string | null) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

async function processarBuscas(siteOrigin: string) {
  const { data: buscas, error } = await supabaseAdmin
    .from("buscas_salvas")
    .select("id, user_id, nome, filtros, ultimo_envio, created_at")
    .eq("alerta_email", true)
    .order("ultimo_envio", { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) throw new Error(error.message);

  let enviados = 0, processados = 0, semNovos = 0;

  for (const b of buscas ?? []) {
    processados++;
    const since = (b.ultimo_envio ?? b.created_at) as string;

    let q = supabaseAdmin
      .from("imoveis")
      .select("id, slug, titulo, preco, endereco_cidade, endereco_uf, endereco_bairro, publicado_em")
      .eq("publicado", true)
      .eq("status", "ativo")
      .gt("publicado_em", since)
      .order("publicado_em", { ascending: false })
      .limit(20);
    q = applyFilters(q, (b.filtros as any) ?? {});
    const { data: novos } = await q;

    if (!novos || novos.length === 0) { semNovos++; continue; }

    // Get user email
    const { data: userResp } = await supabaseAdmin.auth.admin.getUserById(b.user_id);
    const email = userResp?.user?.email;
    if (!email) continue;

    const html = renderEmail(b.nome, novos, siteOrigin);
    const messageId = `busca-alerta-${b.id}-${Date.now()}`;

    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        subject: `${novos.length} novo${novos.length === 1 ? "" : "s"} imóvel${novos.length === 1 ? "" : "is"} para "${b.nome}"`,
        html,
        label: "busca_alerta",
        sender_domain: "notify.imob365.com.br",
        from: "imob365 <no-reply@notify.imob365.com.br>",
        purpose: "transactional",
        message_id: messageId,
      },
    });

    await supabaseAdmin
      .from("buscas_salvas")
      .update({ ultimo_envio: new Date().toISOString() })
      .eq("id", b.id);
    enviados++;
  }

  return { processados, enviados, semNovos };
}

export const Route = createFileRoute("/api/public/cron/buscas-alertas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.trim() === "" || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin = new URL(request.url).origin;
        const siteUrl = process.env.SITE_URL || origin;
        try {
          const res = await processarBuscas(siteUrl);
          return Response.json({ ok: true, ...res });
        } catch (e: any) {
          return new Response(e?.message ?? "error", { status: 500 });
        }
      },
      GET: async ({ request }) => {
        // allow GET with apikey for easy manual testing / pg_net flexibility
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.trim() === "" || apikey !== expected) return new Response("Unauthorized", { status: 401 });
        const origin = new URL(request.url).origin;
        const siteUrl = process.env.SITE_URL || origin;
        const res = await processarBuscas(siteUrl);
        return Response.json({ ok: true, ...res });
      },
    },
  },
});