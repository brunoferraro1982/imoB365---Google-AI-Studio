-- Bug crítico: provision_trial_business() castava a role padrão para o tipo
-- public."AppRole" (identificador entre aspas, PascalCase), que nunca
-- existiu — o enum real é public.app_role (minúsculo, criado em
-- 20260521133506_...sql). Toda conclusão de onboarding chama esta RPC
-- (src/lib/onboarding.functions.ts -> completeOnboarding), então TODO
-- usuário novo ficava travado com "type \"public.AppRole\" does not exist"
-- ao tentar receber a role padrão (admin/broker) — onboarding 100% quebrado.

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
    CASE WHEN p_tipo = 'imobiliaria' THEN 'admin'::app_role
         ELSE 'broker'::app_role END
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
