-- ============================================================
-- imoB365 — Migration: Perfis, Permissões, Audit Log, Sessões
-- Sprint 1 | 2026-06-22
-- ============================================================

-- ── Perfis de usuário ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_profiles (code, name) VALUES
  ('perfil-corretor',    'Corretor Autônomo'),
  ('perfil-corret-imob', 'Corretor de Imobiliária'),
  ('perfil-adm-imob',    'Gestor de Imobiliária'),
  ('perfil-finac-imob',  'Financeiro'),
  ('perfil-mkt-imob',    'Marketing'),
  ('perfil-jur-imob',    'Jurídico')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ── Permissões base por perfil ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_permissions (
  profile_code TEXT NOT NULL REFERENCES user_profiles(code) ON DELETE CASCADE,
  feature_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
  can_view     BOOLEAN NOT NULL DEFAULT FALSE,
  can_create   BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit     BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete   BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve  BOOLEAN NOT NULL DEFAULT FALSE,
  can_export   BOOLEAN NOT NULL DEFAULT FALSE,
  can_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (profile_code, feature_code)
);

-- Permissões: Corretor Autônomo (acesso básico imobiliário)
INSERT INTO profile_permissions (profile_code, feature_code, can_view, can_create, can_edit, can_delete, can_approve, can_export, can_admin)
VALUES
  ('perfil-corretor', 'mod-imob-cad',      TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-cadim',    TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-leads',    TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-leadshis', TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-chat',     TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-agenda',   TRUE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-nps',      TRUE, TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-imob-comp',     TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-mkt-brand',     TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-mkt-url',       TRUE, TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-elearn-cursos', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('perfil-corretor', 'mod-elearn-cert',   TRUE, FALSE, FALSE, FALSE, FALSE, TRUE,  FALSE)
ON CONFLICT DO NOTHING;

-- Permissões: Gestor de Imobiliária (acesso total ao tenant)
INSERT INTO profile_permissions (profile_code, feature_code, can_view, can_create, can_edit, can_delete, can_approve, can_export, can_admin)
SELECT 'perfil-adm-imob', code, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM modules WHERE parent_code IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Tabela de audit log (append-only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  user_id     UUID,
  action      TEXT NOT NULL,       -- 'login', 'logout', 'create', 'update', 'delete', 'plan_change', etc.
  resource    TEXT,                 -- 'imovel', 'lead', 'user', 'plan', etc.
  resource_id TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant    ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user      ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource  ON audit_log(resource, resource_id);

-- RLS: super_admin vê tudo; admin vê apenas seu tenant; outros sem acesso
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_super_admin ON audit_log;
CREATE POLICY audit_log_super_admin ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS audit_log_tenant_admin ON audit_log;
CREATE POLICY audit_log_tenant_admin ON audit_log
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- DENY INSERT/UPDATE/DELETE para todos (append-only via service_role)
DROP POLICY IF EXISTS audit_log_insert_deny ON audit_log;
CREATE POLICY audit_log_deny_modification ON audit_log
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

-- Grant insert apenas para service_role (via server function)
COMMENT ON TABLE audit_log IS 'Log de auditoria imutável — INSERT apenas via service_role, sem UPDATE/DELETE';

-- ── Tabela de sessões ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tenant_id       UUID,
  token_hash      TEXT NOT NULL UNIQUE,  -- hash do refresh token, nunca o token em si
  device_name     TEXT,
  device_type     TEXT,                  -- 'desktop', 'mobile', 'tablet'
  ip_address      INET,
  user_agent      TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,           -- NULL = sessão ativa
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON user_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token     ON user_sessions(token_hash);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_own_user ON user_sessions;
CREATE POLICY sessions_own_user ON user_sessions
  FOR ALL USING (user_id = auth.uid());

-- ── Coluna plan_code em tenants (se não existir) ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'plan_code'
  ) THEN
    ALTER TABLE tenants ADD COLUMN plan_code TEXT REFERENCES plans(code) DEFAULT 'plan-free';
    ALTER TABLE tenants ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'
      CHECK (plan_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended', 'free'));
    ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMPTZ;
    ALTER TABLE tenants ADD COLUMN plan_starts_at TIMESTAMPTZ;
    ALTER TABLE tenants ADD COLUMN plan_ends_at TIMESTAMPTZ;
    COMMENT ON COLUMN tenants.plan_code IS 'Plano atual — FK para plans.code';
    COMMENT ON COLUMN tenants.plan_status IS 'trial|active|past_due|canceled|suspended|free';
  END IF;
END $$;

-- ── Coluna mfa_required em profiles (se não existir) ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'mfa_required'
  ) THEN
    ALTER TABLE profiles ADD COLUMN mfa_required BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE profiles ADD COLUMN mfa_exempt    BOOLEAN NOT NULL DEFAULT FALSE;
    COMMENT ON COLUMN profiles.mfa_required IS 'TRUE = MFA obrigatório para este perfil';
    COMMENT ON COLUMN profiles.mfa_exempt    IS 'TRUE = isento de MFA (ex: super admin em dev)';
  END IF;
END $$;

-- Super admin imob365br@gmail.com: MFA isento até produção (RN específica)
UPDATE profiles SET mfa_exempt = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'imob365br@gmail.com'
);

-- Perfis que exigem MFA (quando habilitado globalmente)
-- Gestor e Financeiro terão MFA obrigatório — configurável por variável de ambiente
-- Por ora: inserir flag no profile mas NÃO forçar (ativado na entrada em produção)
COMMENT ON COLUMN profiles.mfa_required IS 'Controlado por env MFA_ENFORCE=true — não forçar antes de produção';

COMMENT ON TABLE user_sessions IS 'Sessões ativas por usuário — permite revogação granular';
