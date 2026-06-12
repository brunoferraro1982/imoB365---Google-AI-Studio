-- ============================================================
-- Migration: Auditoria de RLS — habilitar em tabelas faltantes
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE 1: Habilitar RLS em tabelas que podem estar sem ele
-- (seguro — não quebra tabelas que já têm RLS ativo)
-- ────────────────────────────────────────────────────────────

-- Tabelas core do domínio imobiliário
ALTER TABLE IF EXISTS imoveis           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visitas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contratos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS modelos_contrato  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plano_contas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS centros_custo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lancamentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comissoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campanhas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_modules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS route_aliases     ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PARTE 2: Policies de isolamento por tenant_id
-- Para tabelas que ainda não têm policy de isolamento
-- ────────────────────────────────────────────────────────────

-- Helper: função para obter tenant_id do usuário autenticado via profiles
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- imoveis
DROP POLICY IF EXISTS "tenant_isolation_imoveis" ON imoveis;
CREATE POLICY "tenant_isolation_imoveis"
  ON imoveis
  USING (tenant_id = auth_tenant_id());

-- leads
DROP POLICY IF EXISTS "tenant_isolation_leads" ON leads;
CREATE POLICY "tenant_isolation_leads"
  ON leads
  USING (tenant_id = auth_tenant_id());

-- visitas
DROP POLICY IF EXISTS "tenant_isolation_visitas" ON visitas;
CREATE POLICY "tenant_isolation_visitas"
  ON visitas
  USING (tenant_id = auth_tenant_id());

-- contratos
DROP POLICY IF EXISTS "tenant_isolation_contratos" ON contratos;
CREATE POLICY "tenant_isolation_contratos"
  ON contratos
  USING (tenant_id = auth_tenant_id());

-- modelos_contrato
DROP POLICY IF EXISTS "tenant_isolation_modelos_contrato" ON modelos_contrato;
CREATE POLICY "tenant_isolation_modelos_contrato"
  ON modelos_contrato
  USING (tenant_id = auth_tenant_id());

-- plano_contas
DROP POLICY IF EXISTS "tenant_isolation_plano_contas" ON plano_contas;
CREATE POLICY "tenant_isolation_plano_contas"
  ON plano_contas
  USING (tenant_id = auth_tenant_id());

-- centros_custo
DROP POLICY IF EXISTS "tenant_isolation_centros_custo" ON centros_custo;
CREATE POLICY "tenant_isolation_centros_custo"
  ON centros_custo
  USING (tenant_id = auth_tenant_id());

-- lancamentos
DROP POLICY IF EXISTS "tenant_isolation_lancamentos" ON lancamentos;
CREATE POLICY "tenant_isolation_lancamentos"
  ON lancamentos
  USING (tenant_id = auth_tenant_id());

-- comissoes
DROP POLICY IF EXISTS "tenant_isolation_comissoes" ON comissoes;
CREATE POLICY "tenant_isolation_comissoes"
  ON comissoes
  USING (tenant_id = auth_tenant_id());

-- campanhas
DROP POLICY IF EXISTS "tenant_isolation_campanhas" ON campanhas;
CREATE POLICY "tenant_isolation_campanhas"
  ON campanhas
  USING (tenant_id = auth_tenant_id());

-- documentos
DROP POLICY IF EXISTS "tenant_isolation_documentos" ON documentos;
CREATE POLICY "tenant_isolation_documentos"
  ON documentos
  USING (tenant_id = auth_tenant_id());

-- profiles: usuário vê apenas o próprio perfil ou colegas do mesmo tenant
DROP POLICY IF EXISTS "tenant_isolation_profiles" ON profiles;
CREATE POLICY "tenant_isolation_profiles"
  ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR tenant_id = auth_tenant_id()
  );

-- ────────────────────────────────────────────────────────────
-- PARTE 3: tenants — super_admin vê todos, tenant vê o próprio
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenant_sees_own" ON tenants;
CREATE POLICY "tenant_sees_own"
  ON tenants
  FOR SELECT
  USING (
    id = auth_tenant_id()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- PARTE 4: Verificação de sanidade — todas as tabelas com RLS?
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t RECORD;
  count_no_rls INT := 0;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
  LOOP
    RAISE WARNING 'TABELA SEM RLS: %', t.tablename;
    count_no_rls := count_no_rls + 1;
  END LOOP;

  IF count_no_rls = 0 THEN
    RAISE NOTICE 'OK: Todas as tabelas públicas têm RLS habilitado';
  ELSE
    RAISE NOTICE 'ATENÇÃO: % tabela(s) ainda sem RLS — revisar manualmente', count_no_rls;
  END IF;
END $$;

