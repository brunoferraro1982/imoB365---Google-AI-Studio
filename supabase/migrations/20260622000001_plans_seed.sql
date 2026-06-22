-- ============================================================
-- imoB365 — Migration: Complemento à tabela plans existente
-- Sprint 1 | 2026-06-22
-- A tabela plans já existe (20260616115023_seed_plans.sql) com PK slug.
-- Esta migration APENAS adiciona colunas ausentes e faz upsert seguro.
-- NÃO recria a tabela. NÃO conflita com seed anterior.
-- ============================================================

-- ── Adicionar colunas ausentes na plans (idempotente via IF NOT EXISTS) ──
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_annual  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS max_imoveis   INTEGER,
  ADD COLUMN IF NOT EXISTS max_users     INTEGER,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_days    INTEGER NOT NULL DEFAULT 0;

-- ── Verificar slugs reais antes de upsert ────────────────────────────────
DO $$
DECLARE
  v_slugs TEXT[];
BEGIN
  SELECT array_agg(slug ORDER BY slug) INTO v_slugs FROM public.plans;
  RAISE NOTICE 'Slugs de planos encontrados: %', v_slugs;
END $$;

-- ── Atualizar metadados dos planos existentes ────────────────────────────
UPDATE public.plans SET
  price_annual  = CASE slug
    WHEN 'basic'    THEN 1054.80
    WHEN 'standard' THEN 2110.80
    WHEN 'stand'    THEN 2110.80
    WHEN 'pro'      THEN 4222.80
    ELSE price_annual
  END,
  max_imoveis   = CASE slug
    WHEN 'free'                    THEN 5
    WHEN 'basic'                   THEN 20
    WHEN 'standard'                THEN 60
    WHEN 'stand'                   THEN 60
    WHEN 'pro'                     THEN 140
    WHEN 'business' THEN -1
    WHEN 'busi'     THEN -1
    ELSE COALESCE(max_imoveis, 5)
  END,
  max_users     = CASE slug
    WHEN 'free'                    THEN 1
    WHEN 'basic'                   THEN 2
    WHEN 'standard'                THEN 5
    WHEN 'stand'                   THEN 5
    WHEN 'pro'                     THEN 15
    WHEN 'business' THEN -1
    WHEN 'busi'     THEN -1
    ELSE COALESCE(max_users, 1)
  END,
  trial_days    = CASE slug
    WHEN 'business' THEN 30
    WHEN 'busi'     THEN 30
    ELSE 0
  END,
  is_active     = TRUE
WHERE slug IN ('free','basic','standard','stand','pro','business','busi');

-- ── Inserir planos ausentes ───────────────────────────────────────────────
DO $$
DECLARE
  v_has_standard BOOLEAN;
  v_has_business BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.plans WHERE slug IN ('standard','stand'))
    INTO v_has_standard;
  SELECT EXISTS(SELECT 1 FROM public.plans WHERE slug IN ('business','busi'))
    INTO v_has_business;

  IF NOT v_has_standard THEN
    INSERT INTO public.plans (slug, name, price_monthly, price_annual, max_imoveis, max_users, is_active)
    VALUES ('standard', 'Standard', 199.90, 2110.80, 60, 5, TRUE)
    ON CONFLICT (slug) DO NOTHING;
    RAISE NOTICE 'Plano standard inserido';
  END IF;

  IF NOT v_has_business THEN
    INSERT INTO public.plans (slug, name, price_monthly, price_annual, max_imoveis, max_users, is_active, trial_days)
    VALUES ('business', 'Business', NULL, NULL, -1, -1, TRUE, 30)
    ON CONFLICT (slug) DO NOTHING;
    RAISE NOTICE 'Plano business inserido';
  END IF;
END $$;

-- ── Garantir plano free existe ───────────────────────────────────────────
INSERT INTO public.plans (slug, name, price_monthly, price_annual, max_imoveis, max_users, is_active)
VALUES ('free', 'Free', 0.00, 0.00, 5, 1, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = 0.00,
  is_active     = TRUE;

-- ── Resultado final ──────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '=== Planos após migration ===';
  FOR r IN SELECT slug, name, price_monthly, max_imoveis, max_users FROM public.plans ORDER BY slug LOOP
    RAISE NOTICE '  % | % | R$ % | %imov | %users',
      r.slug, r.name, r.price_monthly, r.max_imoveis, r.max_users;
  END LOOP;
END $$;
