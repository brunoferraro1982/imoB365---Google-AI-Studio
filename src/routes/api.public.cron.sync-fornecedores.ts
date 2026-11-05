import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sincronizarFornecedor, type Fonte, type Relatorio } from "@/lib/syncFornecedores.server";

// Disparado toda sexta 23:59 por tarefas agendadas do Claude Cowork (uma por
// construtora). Token próprio (SYNC_FORNECEDORES_TOKEN no .env da VPS) — não
// a chave anon usada pelos crons internos, porque quem chama é um agente
// externo. Sem segredo de banco do lado de quem chama.
function tokenOk(recebido: string) {
  const esperado = process.env.SYNC_FORNECEDORES_TOKEN ?? "";
  if (esperado.length < 24 || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

function texto(r: Relatorio) {
  const bloco = (titulo: string, itens: string[]) =>
    itens.length ? `\n${titulo}\n${itens.map((i) => `- ${i}`).join("\n")}` : "";
  return (
    `Sincronização ${r.fonte.toUpperCase()} — ${r.executado_em}\n${r.resumo}` +
    bloco("Aplicado no portal:", r.aplicado) +
    bloco("Para revisar:", r.revisar) +
    bloco("Erros:", r.erros)
  );
}

export const Route = createFileRoute("/api/public/cron/sync-fornecedores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!tokenOk(request.headers.get("x-sync-token") ?? ""))
          return new Response("Unauthorized", { status: 401 });
        const fonte = new URL(request.url).searchParams.get("fonte") as Fonte | null;
        if (fonte !== "econ" && fonte !== "coralon")
          return Response.json(
            { ok: false, erro: "fonte deve ser econ ou coralon" },
            { status: 400 },
          );
        try {
          const relatorio = await sincronizarFornecedor(supabaseAdmin, fonte);
          return Response.json({
            ok: relatorio.erros.length === 0,
            relatorio,
            texto: texto(relatorio),
          });
        } catch (e) {
          return Response.json({ ok: false, erro: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
