-- ============================================================
-- Migration: user_roles RLS + super_admin seed seguro
-- Remove dependência de e-mail hardcoded para autorização
-- ============================================================

-- 1. Habilitar RLS na tabela user_roles
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Remover policies antigas conflitantes (se existirem)
DROP POLICY IF EXISTS "user_sees_own_roles" ON user_roles;
DROP POLICY IF EXISTS "only_super_admin_inserts_roles" ON user_roles;
DROP POLICY IF EXISTS "super_admin_manages_roles" ON user_roles;

-- 3. Policy: usuário vê apenas suas próprias roles
CREATE POLICY "user_sees_own_roles"
  ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Policy: super_admin pode ver todas as roles (para painel admin)
CREATE POLICY "super_admin_reads_all_roles"
  ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- 5. Policy: apenas super_admin pode inserir/atualizar/deletar roles
CREATE POLICY "super_admin_manages_roles"
  ON user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- 6. Seed: garantir super_admin via role, não via e-mail hardcoded
INSERT INTO user_roles (user_id, role)
SELECT au.id, 'super_admin'
FROM auth.users au
WHERE au.email = 'imob365br@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = au.id AND ur.role = 'super_admin'
  )
ON CONFLICT DO NOTHING;

-- 7. Garantir que o super_admin tenha profile.aprovado = true via role
UPDATE profiles
SET aprovado = true,
    pagamento_validado = true
WHERE id IN (
  SELECT user_id FROM user_roles WHERE role = 'super_admin'
);

-- 8. Verificação de sanidade
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'user_roles';

  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'FALHA: RLS não foi habilitado em user_roles';
  END IF;

  RAISE NOTICE 'OK: RLS habilitado em user_roles';
END $$;

