-- Base de conhecimento do assistente: formas comuns de perguntar sobre cada
-- entrada. O assistente do /app casa a pergunta do usuário com o título E
-- com estas variações para responder direto da base (sem IA) — decisão de
-- 2026-11-03: perguntas sobre a plataforma usam sempre a base; o Gemini fica
-- só para o que a base não cobre ou para temas fora da plataforma.
ALTER TABLE public.ai_knowledge_base
  ADD COLUMN IF NOT EXISTS perguntas text[] NOT NULL DEFAULT '{}';

-- Títulos únicos permitem semear/atualizar entradas por título (upsert).
CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_base_titulo_uidx
  ON public.ai_knowledge_base (titulo);
