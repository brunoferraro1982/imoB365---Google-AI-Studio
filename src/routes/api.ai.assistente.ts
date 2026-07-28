import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { perguntarAssistente } from "@/lib/aiAssistant";

// Rota crua (não createServerFn) — precisa devolver um Response com corpo
// em streaming pra repassar os tokens do Ollama conforme chegam, em vez
// de esperar a resposta inteira (que pode levar vários segundos numa VPS
// sem GPU). Autenticação validada manualmente com o token do próprio
// usuário (mesmo padrão de src/integrations/supabase/auth-middleware.ts),
// já que middleware de createServerFn não se aplica aqui.

const PLANOS_ILIMITADOS = ["pro", "business"];
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

export const Route = createFileRoute("/api/ai/assistente")({
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
        const userId = claims.claims.sub as string;

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        const pergunta = String(body?.pergunta ?? "").trim();
        if (pergunta.length < 3 || pergunta.length > 500) {
          return new Response("Pergunta deve ter entre 3 e 500 caracteres.", { status: 400 });
        }
        const pagina = typeof body?.pagina === "string" ? body.pagina.slice(0, 200) : undefined;
        // CLM Sprint 14 — contexto RAG específico de um contrato (dados +
        // cláusulas do modelo aplicado), quando a pergunta parte de
        // app.contratos.$id.tsx. RLS do client autenticado acima já garante
        // que só um membro do tenant dono do contrato recebe esse contexto.
        const contratoId =
          typeof body?.contratoId === "string" && /^[0-9a-f-]{36}$/i.test(body.contratoId)
            ? body.contratoId
            : undefined;

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", userId)
          .maybeSingle();
        let ilimitado = false;
        if (profile?.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("plano_slug")
            .eq("id", profile.tenant_id)
            .maybeSingle();
          ilimitado = PLANOS_ILIMITADOS.includes(tenant?.plano_slug ?? "");
        }

        if (!ilimitado) {
          const rl = checkRateLimit(`ai-assistente:${userId}`, {
            max: RATE_LIMIT_MAX,
            windowMs: RATE_LIMIT_WINDOW_MS,
          });
          if (!rl.allowed) {
            return new Response(
              `Limite de ${RATE_LIMIT_MAX} perguntas a cada 2 horas atingido. Tente novamente em ${Math.ceil(rl.retryAfterSeconds / 60)} min, ou assine um plano Pro/Business para acesso ilimitado.`,
              { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
            );
          }
        }

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              await perguntarAssistente(
                pergunta,
                supabase,
                (chunk) => {
                  controller.enqueue(encoder.encode(chunk));
                },
                pagina,
                contratoId,
              );
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
