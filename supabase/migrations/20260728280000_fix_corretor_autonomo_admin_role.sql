-- Achado real de produção (2026-07-28): um corretor autônomo que completa o
-- onboarding sozinho (p_tipo <> 'imobiliaria') virava o único usuário do
-- próprio tenant individual, mas só recebia role='broker' — nunca 'admin'.
-- Como a correção de RBAC de 2026-07-24 passou a exigir admin OU financeiro
-- pra Financeiro (e broker tem `ajustes: []`, zero acesso a Configurações
-- inteiro), esse usuário ficava sem NENHUM controle administrativo sobre a
-- própria conta — nem ele, nem ninguém no tenant. Confirmado seguro dar as
-- duas roles simultaneamente: user_roles não tem UNIQUE (user_id,tenant_id)
-- só (user_id,tenant_id,role), e toda policy/RLS do projeto usa OR entre
-- roles (has_role_in_tenant), nunca "só broker E não admin".
--
-- Comportamento de 'imobiliaria' (só admin, sem broker) preservado
-- exatamente como estava — o problema é específico de quem NÃO é
-- imobiliária (hoje só 'corretor', mas cobre qualquer tipo futuro).
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
  v_slug := lower(
    regexp_replace(
      translate(p_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  v_slug := trim(both '-' from v_slug);
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.tenants (nome, slug, plano_slug, status, trial_ends_at, tipo_tenant)
  VALUES (
    coalesce(p_imob_nome, p_nome),
    v_slug,
    v_plan_slug,
    'trial',
    now() + interval '30 days',
    p_tipo
  )
  RETURNING id INTO v_tenant_id;

  PERFORM set_config('app.system_op', 'true', true);

  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      aprovado = true
  WHERE id = p_user_id;

  PERFORM set_config('app.system_op', '', true);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (
    p_user_id,
    v_tenant_id,
    CASE WHEN p_tipo = 'imobiliaria' THEN 'admin'::app_role
         ELSE 'broker'::app_role END
  )
  ON CONFLICT DO NOTHING;

  -- Fix real (2026-07-28): quem não é imobiliária é o único usuário do
  -- próprio tenant individual — precisa de 'admin' também, além de 'broker'.
  IF p_tipo <> 'imobiliaria' THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (p_user_id, v_tenant_id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

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
