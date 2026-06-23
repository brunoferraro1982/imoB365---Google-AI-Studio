-- Sprint 8: LGPD + Auditoria
-- audit_log, consent_records, data_subject_requests + triggers e funções SECURITY DEFINER

BEGIN;

-- ============================================================
-- 1. AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action     TEXT        NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'access')),
  entity     TEXT,
  entity_id  TEXT,
  user_id    UUID,
  tenant_id  UUID,
  metadata   JSONB
);

-- Índices para as queries mais comuns do painel de auditoria
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx   ON public.audit_log (user_id,   created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity,    created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Super_admin vê tudo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_super_admin'
  ) THEN
    CREATE POLICY audit_super_admin ON public.audit_log
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;

  -- Admin vê logs do próprio tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_tenant_admin'
  ) THEN
    CREATE POLICY audit_tenant_admin ON public.audit_log
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM   public.user_roles ur
          JOIN   public.profiles   p ON p.id = auth.uid()
          WHERE  ur.user_id = auth.uid()
            AND  ur.role = 'admin'
            AND  p.tenant_id = audit_log.tenant_id
        )
      );
  END IF;
END $$;

-- Função helper que insere no audit_log sem verificar RLS (SECURITY DEFINER)
-- Usada pelos triggers e por funções internas.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action    TEXT,
  p_entity    TEXT,
  p_entity_id TEXT,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata  JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (action, entity, entity_id, user_id, tenant_id, metadata)
  VALUES (p_action, p_entity, p_entity_id, auth.uid(), p_tenant_id, p_metadata);
EXCEPTION WHEN OTHERS THEN
  -- Nunca deixar falha de auditoria bloquear a operação principal
  NULL;
END;
$$;

-- Trigger genérico de auditoria (sem GRANT — chamado só por triggers)
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action    TEXT;
  v_record_id TEXT;
  v_tenant_id UUID;
  v_metadata  JSONB;
BEGIN
  v_action := lower(TG_OP);  -- 'insert', 'update', 'delete'

  IF TG_OP = 'DELETE' THEN
    v_record_id := (OLD.id)::TEXT;
    v_tenant_id := CASE WHEN TG_TABLE_NAME = 'tenants' THEN OLD.id
                        ELSE (OLD.tenant_id)::UUID END;
    v_metadata  := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := (NEW.id)::TEXT;
    v_tenant_id := CASE WHEN TG_TABLE_NAME = 'tenants' THEN NEW.id
                        ELSE (NEW.tenant_id)::UUID END;
    v_metadata  := jsonb_build_object('new', to_jsonb(NEW));
  ELSE -- UPDATE
    v_record_id := (NEW.id)::TEXT;
    v_tenant_id := CASE WHEN TG_TABLE_NAME = 'tenants' THEN NEW.id
                        ELSE (NEW.tenant_id)::UUID END;
    -- Registrar apenas campos que mudaram (não incluir timestamps de sistema)
    SELECT jsonb_object_agg(key, value)
    INTO   v_metadata
    FROM   jsonb_each(to_jsonb(NEW))
    WHERE  to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
      AND  key NOT IN ('updated_at', 'created_at');
    v_metadata := jsonb_build_object('changed', COALESCE(v_metadata, '{}'));
  END IF;

  INSERT INTO public.audit_log (action, entity, entity_id, user_id, tenant_id, metadata)
  VALUES (v_action, TG_TABLE_NAME, v_record_id, auth.uid(), v_tenant_id, v_metadata);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attaches aos recursos sensíveis
DO $$ BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_profiles') THEN
    CREATE TRIGGER audit_profiles
      AFTER INSERT OR UPDATE OR DELETE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  END IF;

  -- tenants
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_tenants') THEN
    CREATE TRIGGER audit_tenants
      AFTER INSERT OR UPDATE OR DELETE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  END IF;

  -- user_roles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_user_roles') THEN
    CREATE TRIGGER audit_user_roles
      AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  END IF;

  -- contratos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_contratos') THEN
    CREATE TRIGGER audit_contratos
      AFTER INSERT OR UPDATE OR DELETE ON public.contratos
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  END IF;

  -- imoveis
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_imoveis') THEN
    CREATE TRIGGER audit_imoveis
      AFTER INSERT OR UPDATE OR DELETE ON public.imoveis
      FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
  END IF;
END $$;

-- ============================================================
-- 2. CONSENT RECORDS (consentimento por finalidade)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consent_records (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('cookies_analytics', 'marketing_email', 'data_processing')),
  granted     BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='consent_records' AND policyname='consent_own'
  ) THEN
    CREATE POLICY consent_own ON public.consent_records
      FOR ALL TO authenticated
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- UPSERT de consentimento
CREATE OR REPLACE FUNCTION public.set_consent(p_type TEXT, p_granted BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type NOT IN ('cookies_analytics', 'marketing_email', 'data_processing') THEN
    RAISE EXCEPTION 'Tipo de consentimento inválido: %', p_type;
  END IF;

  INSERT INTO public.consent_records (user_id, type, granted, granted_at, revoked_at)
  VALUES (
    auth.uid(),
    p_type,
    p_granted,
    CASE WHEN p_granted THEN NOW() ELSE NULL END,
    CASE WHEN NOT p_granted THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id, type) DO UPDATE SET
    granted    = EXCLUDED.granted,
    granted_at = CASE WHEN EXCLUDED.granted THEN NOW() ELSE consent_records.granted_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.granted THEN NOW() ELSE NULL END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_consent(TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- 3. DATA SUBJECT REQUESTS (LGPD Art. 18)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id),
  tenant_id    UUID        REFERENCES public.tenants(id),
  type         TEXT        NOT NULL CHECK (type IN ('access', 'erasure', 'portability', 'correction', 'objection')),
  status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  handled_by   UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS dsr_user_idx ON public.data_subject_requests (user_id, created_at DESC);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_subject_requests' AND policyname='dsr_own'
  ) THEN
    CREATE POLICY dsr_own ON public.data_subject_requests
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_subject_requests' AND policyname='dsr_super_admin'
  ) THEN
    CREATE POLICY dsr_super_admin ON public.data_subject_requests
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;

-- Usuário submete solicitação LGPD
CREATE OR REPLACE FUNCTION public.submit_lgpd_request(
  p_type  TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_id        UUID;
BEGIN
  IF p_type NOT IN ('access', 'erasure', 'portability', 'correction', 'objection') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_type;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.data_subject_requests (user_id, tenant_id, type, notes)
  VALUES (auth.uid(), v_tenant_id, p_type, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_lgpd_request(TEXT, TEXT) TO authenticated;

-- Super_admin atualiza status de uma solicitação
CREATE OR REPLACE FUNCTION public.handle_lgpd_request(
  p_request_id UUID,
  p_status     TEXT,
  p_notes      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Apenas super_admin pode atualizar solicitações LGPD';
  END IF;

  UPDATE public.data_subject_requests
  SET    status       = p_status,
         notes        = COALESCE(p_notes, notes),
         completed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN NOW() ELSE NULL END,
         handled_by   = auth.uid()
  WHERE  id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_lgpd_request(UUID, TEXT, TEXT) TO authenticated;

-- Anonimizar dados pessoais do usuário (super_admin / erasure flow)
CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anon_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Apenas super_admin pode anonimizar usuários';
  END IF;

  v_anon_name := 'Usuário removido ' || substr(p_user_id::TEXT, 1, 8);

  -- Anonimizar profile
  UPDATE public.profiles
  SET    nome              = v_anon_name,
         avatar_url        = NULL,
         tipo_usuario      = NULL,
         imobiliaria_nome  = NULL,
         plano_pretendido  = NULL,
         pagamento_metodo  = NULL
  WHERE  id = p_user_id;

  -- Revogar todos os consentimentos
  UPDATE public.consent_records
  SET    granted = FALSE, revoked_at = NOW()
  WHERE  user_id = p_user_id;

  -- Registrar no audit_log
  INSERT INTO public.audit_log (action, entity, entity_id, user_id, tenant_id, metadata)
  VALUES ('delete', 'user_pii', p_user_id::TEXT, auth.uid(), NULL,
          jsonb_build_object('reason', 'lgpd_erasure'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonymize_user(UUID) TO authenticated;

COMMIT;
