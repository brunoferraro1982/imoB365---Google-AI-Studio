-- Sprint 6: RBAC — tabela user_permissions para overrides por Gestor
-- Admins podem conceder ou revogar ações específicas por usuário,
-- sobrepondo a matriz estática de roles definida em permissions.ts.

BEGIN;

-- 1. Tabela de overrides de permissão
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  module       TEXT        NOT NULL,
  action       TEXT        NOT NULL CHECK (action IN ('read', 'write', 'delete', 'config')),
  granted      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, module, action)
);

-- 2. RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Usuário lê suas próprias permissões
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_permissions' AND policyname = 'perm_select_own'
  ) THEN
    CREATE POLICY perm_select_own ON public.user_permissions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Admin lê todas as permissões do seu tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_permissions' AND policyname = 'perm_select_admin'
  ) THEN
    CREATE POLICY perm_select_admin ON public.user_permissions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.profiles   p  ON p.id = auth.uid()
          WHERE  ur.user_id = auth.uid()
            AND  ur.role IN ('admin', 'super_admin')
            AND  (p.tenant_id = user_permissions.tenant_id OR ur.role = 'super_admin')
        )
      );
  END IF;

  -- Admin gerencia (INSERT/UPDATE/DELETE) permissões do seu tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_permissions' AND policyname = 'perm_manage_admin'
  ) THEN
    CREATE POLICY perm_manage_admin ON public.user_permissions
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.profiles   p  ON p.id = auth.uid()
          WHERE  ur.user_id = auth.uid()
            AND  ur.role IN ('admin', 'super_admin')
            AND  (p.tenant_id = user_permissions.tenant_id OR ur.role = 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.profiles   p  ON p.id = auth.uid()
          WHERE  ur.user_id = auth.uid()
            AND  ur.role IN ('admin', 'super_admin')
            AND  (p.tenant_id = user_permissions.tenant_id OR ur.role = 'super_admin')
        )
      );
  END IF;
END $$;

-- 3. UPSERT de override — valida que chamador é admin do mesmo tenant
CREATE OR REPLACE FUNCTION public.set_user_permission(
  p_user_id UUID,
  p_module  TEXT,
  p_action  TEXT,
  p_granted BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_admin  BOOLEAN;
BEGIN
  IF p_action NOT IN ('read', 'write', 'delete', 'config') THEN
    RAISE EXCEPTION 'Ação inválida: %', p_action;
  END IF;

  SELECT p.tenant_id,
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE  ur.user_id = auth.uid()
             AND  ur.role IN ('admin', 'super_admin')
         )
  INTO v_tenant_id, v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas admins podem gerenciar permissões';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE  id = p_user_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence ao mesmo tenant';
  END IF;

  INSERT INTO public.user_permissions (tenant_id, user_id, module, action, granted, created_by)
  VALUES (v_tenant_id, p_user_id, p_module, p_action, p_granted, auth.uid())
  ON CONFLICT (tenant_id, user_id, module, action)
  DO UPDATE SET
    granted    = EXCLUDED.granted,
    created_by = EXCLUDED.created_by,
    created_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_permission(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 4. Remove override (restaura padrão da role)
CREATE OR REPLACE FUNCTION public.remove_user_permission(
  p_user_id UUID,
  p_module  TEXT,
  p_action  TEXT
)
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
           WHERE  ur.user_id = auth.uid()
             AND  ur.role IN ('admin', 'super_admin')
         )
  INTO v_tenant_id, v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas admins podem gerenciar permissões';
  END IF;

  DELETE FROM public.user_permissions
  WHERE  tenant_id = v_tenant_id
    AND  user_id   = p_user_id
    AND  module    = p_module
    AND  action    = p_action;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_permission(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
