-- ============================================================
-- Sprint 4: Slug migration (plan slugs → spec format) +
--           colunas de onboarding e trial + wizard DB support
-- ============================================================

-- 1. Novas colunas ─────────────────────────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: usuários já aprovados são considerados onboarding concluído.
UPDATE public.profiles
  SET onboarding_completed_at = NOW()
  WHERE aprovado = TRUE AND onboarding_completed_at IS NULL;

-- 2. Rename plan slugs (bypassa FKs via session_replication_role) ──
SET session_replication_role = 'replica';

-- 2a. Renomeia os planos na tabela plans
UPDATE public.plans SET slug = 'plan-free'  WHERE slug = 'free';
UPDATE public.plans SET slug = 'plan-basic' WHERE slug = 'basic';
UPDATE public.plans SET slug = 'plan-stand' WHERE slug = 'standard';
UPDATE public.plans SET slug = 'plan-pro'   WHERE slug = 'pro';
UPDATE public.plans SET slug = 'plan-busi'  WHERE slug = 'business';
-- starter era o plano original (substituído por free); remapeia para plan-free
UPDATE public.plans SET slug = 'plan-free'  WHERE slug = 'starter';

-- 2b. Atualiza tenants.plano_slug
UPDATE public.tenants SET plano_slug = 'plan-free'  WHERE plano_slug = 'free';
UPDATE public.tenants SET plano_slug = 'plan-basic' WHERE plano_slug = 'basic';
UPDATE public.tenants SET plano_slug = 'plan-stand' WHERE plano_slug = 'standard';
UPDATE public.tenants SET plano_slug = 'plan-pro'   WHERE plano_slug = 'pro';
UPDATE public.tenants SET plano_slug = 'plan-busi'  WHERE plano_slug = 'business';
UPDATE public.tenants SET plano_slug = 'plan-free'  WHERE plano_slug = 'starter';

-- 2c. Atualiza modules.requires_plan
UPDATE public.modules SET requires_plan = 'plan-free'  WHERE requires_plan IN ('starter','free');
UPDATE public.modules SET requires_plan = 'plan-pro'   WHERE requires_plan = 'pro';
UPDATE public.modules SET requires_plan = 'plan-busi'  WHERE requires_plan = 'business';

SET session_replication_role = 'DEFAULT';

-- 3. Atualiza provision_tenant_modules() com novos slugs ───────────
CREATE OR REPLACE FUNCTION public.provision_tenant_modules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tier   INT;
  wanted TEXT[];
  hi     TEXT[] := ARRAY['imobiliario','ajustes','financeiro','juridico','marketing','elearning'];
BEGIN
  tier := CASE COALESCE(NEW.plano_slug, 'plan-free')
            WHEN 'plan-free'  THEN 0
            WHEN 'plan-basic' THEN 1
            WHEN 'plan-stand' THEN 2
            WHEN 'plan-pro'   THEN 3
            WHEN 'plan-busi'  THEN 4
            ELSE 0
          END;

  wanted := ARRAY['imobiliario','ajustes'];
  IF tier >= 2 THEN wanted := wanted || 'financeiro'::TEXT; END IF;
  IF tier >= 3 THEN wanted := wanted || ARRAY['juridico','marketing']; END IF;
  IF tier >= 4 THEN wanted := wanted || 'elearning'::TEXT; END IF;

  INSERT INTO public.tenant_modules (tenant_id, module_slug, enabled)
  SELECT NEW.id, w, TRUE FROM UNNEST(wanted) w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_modules tm
    WHERE tm.tenant_id = NEW.id AND tm.module_slug = w
  );

  UPDATE public.tenant_modules SET enabled = TRUE
  WHERE tenant_id = NEW.id AND module_slug = ANY(wanted);

  UPDATE public.tenant_modules SET enabled = FALSE
  WHERE tenant_id = NEW.id AND module_slug = ANY(hi) AND NOT (module_slug = ANY(wanted));

  RETURN NEW;
END;
$$;

-- 4. Atualiza protect_profile_privileged_cols para permitir onboarding ──
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_cols()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_free             BOOLEAN;
  completing_onboard  BOOLEAN;
BEGIN
  is_free := LOWER(COALESCE(NEW.plano_pretendido, 'plan-free'))
             IN ('free', 'plan-free', 'gratis', 'grátis');

  -- Detecta conclusão de onboarding: campo saindo de NULL para preenchido
  completing_onboard := (NEW.onboarding_completed_at IS NOT NULL
                         AND (OLD.onboarding_completed_at IS NULL OR TG_OP = 'INSERT'));

  -- Auto-aprovação: plano free OU conclusão de onboarding (trial Business)
  IF is_free OR completing_onboard THEN
    NEW.aprovado := TRUE;
  END IF;

  -- Anti-bypass: usuário comum não altera colunas privilegiadas
  IF TG_OP = 'UPDATE' AND NOT public.is_super_admin_safe() THEN
    -- aprovado: só pode mudar via auto-aprovação (acima)
    IF NEW.aprovado IS DISTINCT FROM OLD.aprovado
       AND NOT is_free AND NOT completing_onboard THEN
      RAISE EXCEPTION 'Alteracao de coluna privilegiada do perfil nao autorizada';
    END IF;
    -- tenant_id: permite primeira atribuição (NULL → UUID), bloqueia troca posterior
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       AND OLD.tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Alteracao de coluna privilegiada do perfil nao autorizada';
    END IF;
    -- pagamento_validado: nunca pelo usuário
    IF NEW.pagamento_validado IS DISTINCT FROM OLD.pagamento_validado THEN
      RAISE EXCEPTION 'Alteracao de coluna privilegiada do perfil nao autorizada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Função complete_onboarding — executa atomicamente: ──────────────
--    cria tenant, provisiona módulos, atualiza perfil, auto-aprova.
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_tipo_usuario    TEXT,
  p_nome            TEXT,
  p_imobiliaria_nome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_tenant_id UUID;
  v_base_slug TEXT;
  v_slug      TEXT;
  v_counter   INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding: not authenticated';
  END IF;

  -- Verifica se o usuário já tem tenant (idempotente)
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    -- Gera slug único para o tenant
    v_base_slug := LOWER(
      REGEXP_REPLACE(
        COALESCE(NULLIF(TRIM(p_imobiliaria_nome), ''), NULLIF(TRIM(p_nome), ''), 'imob'),
        '[^a-z0-9]+', '-', 'g'
      )
    );
    v_slug := v_base_slug;

    WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = v_slug) LOOP
      v_counter := v_counter + 1;
      v_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    -- Cria o tenant com Trial Business 30 dias
    INSERT INTO tenants (slug, nome, plano_slug, status, trial_ends_at)
    VALUES (
      v_slug,
      COALESCE(NULLIF(TRIM(p_imobiliaria_nome), ''), NULLIF(TRIM(p_nome), ''), 'Minha Imobiliária'),
      'plan-busi',
      'trial',
      NOW() + INTERVAL '30 days'
    )
    RETURNING id INTO v_tenant_id;

    -- Atribui role admin ao usuário no novo tenant
    INSERT INTO user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, 'admin', v_tenant_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Atualiza perfil:
  --   - tipo_usuario: código do perfil selecionado no Step 1
  --   - tenant_id: permitido pois o trigger aceita NULL → UUID
  --   - onboarding_completed_at: trigger vai auto-setar aprovado = TRUE
  UPDATE profiles SET
    tipo_usuario           = p_tipo_usuario,
    nome                   = COALESCE(NULLIF(TRIM(p_nome), ''), nome),
    tenant_id              = v_tenant_id,
    onboarding_completed_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'tenant_id',    v_tenant_id,
    'completed_at', NOW()
  );
END;
$$;

-- Permite que usuários autenticados chamem esta função
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT) TO authenticated;

-- 6. RLS: permite que o próprio usuário leia seu onboarding_completed_at ──
-- (profiles já tem RLS com política de leitura própria; nenhuma nova política
--  é necessária — o SELECT já está coberto pelas políticas existentes.)
