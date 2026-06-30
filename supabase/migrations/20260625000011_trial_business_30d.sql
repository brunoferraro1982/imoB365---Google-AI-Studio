-- Trial Business 30 dias (spec §3.1)
-- RN-01: Todo usuário recebe plan-busi por 30 dias ao concluir onboarding
-- RN-05: Expirado sem assinatura → plan-free
-- RN-07: Conteúdo excedente ocultado, não excluído

-- 1. Colunas de ciclo de vida na tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz,
  ADD COLUMN IF NOT EXISTS downgrade_to     text REFERENCES public.plans(slug);

-- 2. Função chamada pelo onboarding para provisionar Trial Business automaticamente
--    Cria tenant, provisiona módulos (via trigger existente), vincula profile.
CREATE OR REPLACE FUNCTION public.provision_trial_business(
  p_user_id    uuid,
  p_nome       text,
  p_tipo       text,
  p_imob_nome  text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_slug      text;
  v_plan_slug text := 'business';
BEGIN
  -- Gerar slug a partir do nome
  v_slug := lower(
    regexp_replace(
      translate(p_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  v_slug := trim(both '-' from v_slug);
  -- Garantir unicidade
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  -- Criar tenant com Trial Business 30 dias
  INSERT INTO public.tenants (nome, slug, plano_slug, status, trial_ends_at)
  VALUES (
    coalesce(p_imob_nome, p_nome),
    v_slug,
    v_plan_slug,
    'trial',
    now() + interval '30 days'
  )
  RETURNING id INTO v_tenant_id;

  -- Sinalizar operação de sistema (bypass do trigger protect_profile_privileged_cols)
  PERFORM set_config('app.system_op', 'true', true);

  -- Vincular profile ao tenant + aprovar
  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      aprovado = true
  WHERE id = p_user_id;

  PERFORM set_config('app.system_op', '', true);

  -- Atribuir role padrão
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (
    p_user_id,
    v_tenant_id,
    CASE WHEN p_tipo = 'imobiliaria' THEN 'admin'::public."AppRole"
         ELSE 'broker'::public."AppRole" END
  )
  ON CONFLICT DO NOTHING;

  -- Se corretor, criar registro em corretores
  IF p_tipo = 'corretor' THEN
    INSERT INTO public.corretores (tenant_id, user_id, nome, email, slug, ativo, publico)
    SELECT v_tenant_id, p_user_id, p_nome,
           coalesce(au.email, v_slug || '@trial.imob365.com.br'),
           v_slug, true, true
    FROM auth.users au WHERE au.id = p_user_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'trial_ends_at', (now() + interval '30 days')::text,
    'plan', v_plan_slug
  );
END;
$$;

-- 3. Função cron para auto-downgrade de trials expirados (RN-05)
CREATE OR REPLACE FUNCTION public.cron_expire_trials()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_free_slug text := 'free';
BEGIN
  FOR r IN
    SELECT id, nome FROM public.tenants
    WHERE status = 'trial'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < now()
  LOOP
    UPDATE public.tenants
    SET plano_slug = v_free_slug,
        status = 'active',
        trial_ends_at = NULL
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 4. Atualizar trigger de auto-approve para NÃO auto-aprovar free
--    (agora todos passam pelo trial Business via provision_trial_business)
DROP TRIGGER IF EXISTS tg_protect_profile_cols ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Bypass para operações de sistema (provision_trial_business, cron_expire_trials)
  IF coalesce(current_setting('app.system_op', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  -- Bloquear alteração de colunas privilegiadas por não-admins
  IF TG_OP = 'UPDATE' AND NOT public.is_super_admin_safe() THEN
    IF (NEW.aprovado IS DISTINCT FROM OLD.aprovado)
       OR (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
       OR (NEW.pagamento_validado IS DISTINCT FROM OLD.pagamento_validado) THEN
      RAISE EXCEPTION 'Alteracao de coluna privilegiada do perfil nao autorizada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_protect_profile_cols
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_cols();
