-- Sprint 7: Ciclo de vida do plano — upgrade/downgrade/suspensão/cancelamento

BEGIN;

-- 1. billing_due_at: data de vencimento da próxima fatura (NULL = sem cobrança)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_due_at TIMESTAMPTZ;

-- 2. Muda o plano do próprio tenant (admin da conta)
--    O trigger provision_tenant_modules re-provisiona os módulos automaticamente.
CREATE OR REPLACE FUNCTION public.change_tenant_plan(p_new_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id      UUID;
  v_is_admin       BOOLEAN;
  v_plan_price     NUMERIC;
  v_current_status public.tenant_status;
BEGIN
  -- Resolver tenant e verificar role do chamador
  SELECT p.tenant_id,
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role IN ('admin', 'super_admin')
         )
  INTO v_tenant_id, v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o plano';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para este usuário';
  END IF;

  -- Validar que o plano existe e está ativo
  SELECT preco_mensal
  INTO v_plan_price
  FROM public.plans
  WHERE slug = p_new_plan AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano inválido ou inativo: %', p_new_plan;
  END IF;

  -- Verificar status atual do tenant
  SELECT status INTO v_current_status FROM public.tenants WHERE id = v_tenant_id;

  IF v_current_status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Conta % — não é possível alterar o plano. Contate o suporte.', v_current_status;
  END IF;

  -- Mudar plano; provision_tenant_modules trigger re-provisiona módulos
  UPDATE public.tenants
  SET    plano_slug = p_new_plan,
         status     = 'active'
  WHERE  id = v_tenant_id;

  -- Para planos pagos: definir ou renovar billing_due_at se ainda não definido
  IF v_plan_price > 0 THEN
    UPDATE public.tenants
    SET    billing_due_at = COALESCE(billing_due_at, NOW() + INTERVAL '30 days')
    WHERE  id = v_tenant_id;
  ELSE
    -- Plano gratuito: sem cobrança
    UPDATE public.tenants
    SET    billing_due_at = NULL
    WHERE  id = v_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_tenant_plan(TEXT) TO authenticated;

-- 3. Cancelamento de conta (auto-atendimento pelo admin)
CREATE OR REPLACE FUNCTION public.cancel_tenant()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_admin  BOOLEAN;
BEGIN
  SELECT p.tenant_id,
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = auth.uid()
             AND ur.role = 'admin'
         )
  INTO v_tenant_id, v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas o administrador pode cancelar a conta';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado';
  END IF;

  UPDATE public.tenants
  SET    status        = 'cancelled',
         plano_slug    = 'free',
         billing_due_at = NULL
  WHERE  id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_tenant() TO authenticated;

-- 4. Suspender tenant manualmente (super_admin)
CREATE OR REPLACE FUNCTION public.suspend_tenant(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Apenas super_admin pode suspender tenants';
  END IF;

  UPDATE public.tenants
  SET    status = 'suspended'
  WHERE  id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_tenant(UUID) TO authenticated;

-- 5. Reativar tenant (super_admin) — renova billing_due_at por 30 dias
CREATE OR REPLACE FUNCTION public.reactivate_tenant(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Apenas super_admin pode reativar tenants';
  END IF;

  UPDATE public.tenants
  SET    status        = 'active',
         billing_due_at = CASE
           WHEN billing_due_at IS NOT NULL THEN NOW() + INTERVAL '30 days'
           ELSE NULL
         END
  WHERE  id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_tenant(UUID) TO authenticated;

-- 6. Cron: suspender tenants inadimplentes (sem GRANT — service-role only)
CREATE OR REPLACE FUNCTION public.inadimplencia_suspend_overdue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tenants
  SET    status = 'suspended'
  WHERE  status       = 'active'
    AND  billing_due_at IS NOT NULL
    AND  billing_due_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
-- Sem GRANT: apenas service-role pode executar via cron seguro

COMMIT;
