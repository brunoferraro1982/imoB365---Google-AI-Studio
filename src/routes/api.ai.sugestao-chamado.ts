import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sugerirRespostaChamado } from "@/lib/aiAssistant";

// Central de Atendimento Sprint 9 — sugestão de resposta por IA, gated aos
// planos Pro/Business (mesmo padrão de PLANOS_COM_ACESSO já usado em
// captacao.ts). Rota crua (não createServerFn) pelo mesmo motivo de
// api.ai.assistente.ts: precisa devolver um Response em streaming.
const PLANOS_COM_ACESSO = ["pro", "business"];

export const Route = createFileRoute("/api/ai/sugestao-chamado")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Configuração ausente", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("É preciso estar logado para usar o assistente.", { status: 401 });
        }
        const token = authHeader.replace("Bearer ", "");

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Sessão inválida.", { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        const chamadoId = String(body?.chamadoId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(chamadoId)) {
          return new Response("chamadoId inválido.", { status: 400 });
        }

        // A leitura abaixo roda com o token do próprio usuário — a RLS de
        // `chamados` já garante que só quem tem acesso ao chamado (RLS
        // super_admin/tenant staff/solicitante) recebe uma linha de volta.
        // Sem linha = sem acesso, mesmo resultado de um 403 explícito.
        const { data: chamado } = await supabase
          .from("chamados")
          .select("responsavel_tipo,tenant_id")
          .eq("id", chamadoId)
          .maybeSingle();
        if (!chamado) {
          return new Response("Chamado não encontrado ou sem permissão.", { status: 403 });
        }

        if (chamado.responsavel_tipo === "tenant" && chamado.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("plano_slug")
            .eq("id", chamado.tenant_id)
            .maybeSingle();
          if (!PLANOS_COM_ACESSO.includes(tenant?.plano_slug ?? "")) {
            return new Response(
              "Sugestão de resposta por IA é um recurso dos planos Pro/Business.",
              { status: 403 },
            );
          }
        }

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              await sugerirRespostaChamado(chamadoId, supabase, (chunk) => {
                controller.enqueue(encoder.encode(chunk));
              });
            } catch (err: any) {
              controller.enqueue(
                encoder.encode(
                  `\n\n[Erro: ${err?.message ?? "assistente indisponível no momento"}]`,
                ),
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
