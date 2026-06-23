-- ============================================================
-- Sprint 5: funções de notificação de trial e auto-downgrade
-- ============================================================

-- 1. downgrade_trial_to_free — chamável por usuário (converte o próprio tenant)
--    ou por cron (passa p_tenant_id diretamente com service-role bypass).
CREATE OR REPLACE FUNCTION public.downgrade_trial_to_free(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := p_tenant_id;
BEGIN
  -- Se não foi passado tenant_id, usa o tenant do usuário atual
  IF v_tenant_id IS NULL THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'downgrade_trial_to_free: not authenticated';
    END IF;
    SELECT tenant_id INTO v_tenant_id
    FROM profiles WHERE id = auth.uid();
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'downgrade_trial_to_free: tenant not found';
  END IF;

  -- Só converte se ainda está em trial (idempotente)
  UPDATE tenants SET
    plano_slug = 'plan-free',
    status     = 'active'
  WHERE id = v_tenant_id
    AND status = 'trial';
  -- O trigger tg_provision_tenant_modules dispara no UPDATE de plano_slug
  -- e restringe automaticamente os módulos ao nível Free.
END;
$$;

GRANT EXECUTE ON FUNCTION public.downgrade_trial_to_free(UUID) TO authenticated;

-- 2. expire_all_trials — sem argumento, para uso exclusivo via service-role (cron).
--    Converte todos os tenants com trial expirado de uma vez.
CREATE OR REPLACE FUNCTION public.expire_all_trials()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH expired AS (
    UPDATE tenants SET
      plano_slug = 'plan-free',
      status     = 'active'
    WHERE status = 'trial'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- expire_all_trials só pode ser chamada via service_role (cron)
-- Não concede EXECUTE para authenticated.
