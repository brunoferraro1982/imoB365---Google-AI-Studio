-- ============================================================
-- Migration: tenant_modules — gating de módulos por tenant/plano
-- ============================================================

-- Enum de módulos disponíveis
DO $$ BEGIN
  CREATE TYPE app_module AS ENUM (
    'imobiliario',
    'juridico',
    'financeiro',
    'marketing',
    'ajustes',
    'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela principal: quais módulos cada tenant tem habilitados
CREATE TABLE IF NOT EXISTS tenant_modules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module     app_module NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, module)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant_id
  ON tenant_modules (tenant_id);

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION update_tenant_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_modules_updated_at ON tenant_modules;
CREATE TRIGGER tenant_modules_updated_at
  BEFORE UPDATE ON tenant_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_modules_updated_at();

-- RLS
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

-- Usuário do tenant vê os módulos do próprio tenant
CREATE POLICY "tenant_sees_own_modules"
  ON tenant_modules
  FOR SELECT
  USING (
    tenant_id = (
      SELECT p.tenant_id FROM profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );

-- super_admin vê tudo
CREATE POLICY "super_admin_reads_all_tenant_modules"
  ON tenant_modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- super_admin e admin do tenant gerenciam módulos
CREATE POLICY "admin_manages_tenant_modules"
  ON tenant_modules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
        AND (
          ur.role = 'super_admin'
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.tenant_id = tenant_modules.tenant_id
          )
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- Seed: módulos por plano (tenant 0 = plano business completo)
-- ────────────────────────────────────────────────────────────

-- Função auxiliar: ativar módulos para um tenant de acordo com plano
CREATE OR REPLACE FUNCTION seed_tenant_modules(
  p_tenant_id UUID,
  p_plano     TEXT  -- 'starter' | 'profissional' | 'business'
)
RETURNS VOID AS $$
DECLARE
  v_modules app_module[];
BEGIN
  -- Todos os planos têm imobiliario e ajustes
  v_modules := ARRAY['imobiliario'::app_module, 'ajustes'::app_module];

  IF p_plano IN ('profissional', 'business') THEN
    v_modules := v_modules || ARRAY[
      'financeiro'::app_module,
      'juridico'::app_module
    ];
  END IF;

  IF p_plano = 'business' THEN
    v_modules := v_modules || ARRAY['marketing'::app_module];
  END IF;

  -- Inserir/atualizar módulos
  INSERT INTO tenant_modules (tenant_id, module, enabled)
  SELECT p_tenant_id, unnest(v_modules), true
  ON CONFLICT (tenant_id, module) DO UPDATE
    SET enabled = true;

  -- Desabilitar módulos não incluídos no plano
  UPDATE tenant_modules
  SET enabled = false
  WHERE tenant_id = p_tenant_id
    AND module != ALL(v_modules);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed para o Tenant 0 (imoB365 — plano business completo)
DO $$
DECLARE v_tenant_id UUID;
BEGIN
  -- Buscar tenant principal (imoB365)
  SELECT id INTO v_tenant_id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    PERFORM seed_tenant_modules(v_tenant_id, 'business');
    RAISE NOTICE 'Tenant 0 (%) → módulos business habilitados', v_tenant_id;
  ELSE
    RAISE NOTICE 'Nenhum tenant encontrado — seed ignorado';
  END IF;
END $$;

