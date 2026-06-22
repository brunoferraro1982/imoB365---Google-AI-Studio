// supabase/functions/expire-impulsionamentos/index.ts
// Supabase Edge Function — expira impulsionamentos vencidos e sincroniza destaque em imoveis
// Deploy: supabase functions deploy expire-impulsionamentos
// Cron:   supabase functions deploy expire-impulsionamentos --schedule "0 3 * * *"  (diário às 03:00 UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // Aceita chamada via cron (GET) ou trigger manual (POST com Bearer)
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Proteção básica para chamadas manuais (POST)
  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date().toISOString();

  // ─────────────────────────────────────────────
  // PASSO 1: Buscar impulsionamentos ativos vencidos
  // ─────────────────────────────────────────────
  const { data: vencidos, error: fetchError } = await supabase
    .from("impulsionamentos")
    .select("id, imovel_id, tipo, tenant_id")
    .eq("status", "ativo")
    .lt("data_expiracao", now);

  if (fetchError) {
    console.error("[expire-impulsionamentos] Erro ao buscar vencidos:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!vencidos || vencidos.length === 0) {
    console.log("[expire-impulsionamentos] Nenhum impulsionamento vencido encontrado.");
    return new Response(JSON.stringify({ expired: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const impulsionamentoIds = vencidos.map((i) => i.id);
  const imovelIds = [...new Set(vencidos.map((i) => i.imovel_id))];

  console.log(
    `[expire-impulsionamentos] Expirando ${impulsionamentoIds.length} impulsionamento(s), ` +
    `afetando ${imovelIds.length} imóvel(eis).`
  );

  // ─────────────────────────────────────────────
  // PASSO 2: Marcar impulsionamentos como expirado
  // ─────────────────────────────────────────────
  const { error: updateImpError } = await supabase
    .from("impulsionamentos")
    .update({ status: "expirado" })
    .in("id", impulsionamentoIds);

  if (updateImpError) {
    console.error("[expire-impulsionamentos] Erro ao expirar impulsionamentos:", updateImpError);
    return new Response(JSON.stringify({ error: updateImpError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─────────────────────────────────────────────
  // PASSO 3: Para cada imóvel afetado, verificar se ainda tem
  // impulsionamento ATIVO antes de remover o destaque.
  // (Evita remover destaque de quem tem outro impulsionamento vigente)
  // ─────────────────────────────────────────────
  const { data: aindaAtivos } = await supabase
    .from("impulsionamentos")
    .select("imovel_id")
    .eq("status", "ativo")
    .in("imovel_id", imovelIds);

  const imoveisAindaAtivos = new Set(
    (aindaAtivos ?? []).map((i) => i.imovel_id)
  );

  const imoveisParaRemoverDestaque = imovelIds.filter(
    (id) => !imoveisAindaAtivos.has(id)
  );

  // ─────────────────────────────────────────────
  // PASSO 4: Remover destaque apenas dos imóveis sem impulsionamento ativo
  // ─────────────────────────────────────────────
  if (imoveisParaRemoverDestaque.length > 0) {
    const { error: updateImoveisError } = await supabase
      .from("imoveis")
      .update({ destaque: false })
      .in("id", imoveisParaRemoverDestaque);

    if (updateImoveisError) {
      console.error("[expire-impulsionamentos] Erro ao atualizar destaque:", updateImoveisError);
      return new Response(JSON.stringify({ error: updateImoveisError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ─────────────────────────────────────────────
  // PASSO 5: Log de auditoria
  // ─────────────────────────────────────────────
  const auditRows = vencidos.map((imp) => ({
    tenant_id: imp.tenant_id,
    action: "impulsionamento_expirado",
    entity_type: "impulsionamentos",
    entity_id: imp.imovel_id,
    metadata: { impulsionamento_id: imp.id, tipo: imp.tipo },
  }));

  const { error: auditError } = await supabase
    .from("audit_log")
    .insert(auditRows);

  if (auditError) {
    // Não bloqueia o fluxo — apenas loga
    console.warn("[expire-impulsionamentos] Falha ao gravar audit_log:", auditError);
  }

  const summary = {
    expired: impulsionamentoIds.length,
    imoveis_updated: imoveisParaRemoverDestaque.length,
    imoveis_kept_destaque: imoveisAindaAtivos.size,
    ran_at: now,
  };

  console.log("[expire-impulsionamentos] Concluído:", summary);

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
