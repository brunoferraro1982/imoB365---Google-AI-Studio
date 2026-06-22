-- ============================================================
-- imoB365 — Migration: Complemento à tabela plans (Sprint 1)
-- 2026-06-22
--
-- Schema real da plans (confirmado em 20260616115023_seed_plans.sql):
--   plans(slug, nome, preco_mensal, modulos_incluidos TEXT[], limites JSONB, ativo)
--
-- Esta migration APENAS adiciona colunas novas para Sprint 1.
-- Não recria tabela. Não altera colunas existentes.
-- Slugs reais: free | basic | standard | pro | business
-- ============================================================

-- ── Adicionar colunas Sprint 1 (idempotente) ──────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS preco_anual   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS trial_dias    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_corretores INTEGER;

-- ── Upsert dos novos campos nos planos existentes ─────────────────────────
UPDATE public.plans SET
  preco_anual     = CASE slug
    WHEN 'basic'    THEN 1054.80    -- 99  × 12 × 0.885 (desconto ~11.5%)
    WHEN 'standard' THEN 2110.80    -- 199 × 12 × 0.884
    WHEN 'pro'      THEN 4222.80    -- 349 × 12 × 1.008 (arred.)
    WHEN 'business' THEN NULL       -- negociado
    ELSE 0
  END,
  trial_dias      = CASE slug
    WHEN 'business' THEN 30
    ELSE 0
  END,
  max_corretores  = CASE slug
    WHEN 'free'     THEN 1
    WHEN 'basic'    THEN 3
    WHEN 'standard' THEN 8
    WHEN 'pro'      THEN 20
    WHEN 'business' THEN -1   -- ilimitado
  END
WHERE slug IN ('free','basic','standard','pro','business');

-- ── Verificação ───────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '=== plans após migration Sprint 1 ===';
  FOR r IN
    SELECT slug, nome, preco_mensal, preco_anual, trial_dias, max_corretores
    FROM public.plans ORDER BY preco_mensal NULLS LAST
  LOOP
    RAISE NOTICE '  %-10s | %-10s | R$ % | anual: % | trial: %d | corretores: %',
      r.slug, r.nome, r.preco_mensal, r.preco_anual, r.trial_dias, r.max_corretores;
  END LOOP;
END $$;
