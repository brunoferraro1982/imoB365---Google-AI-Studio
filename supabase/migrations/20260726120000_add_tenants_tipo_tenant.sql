-- Diferenciação visual corretor autônomo vs imobiliária no site público
-- (/site/$slug): a mesma imagem em tenants.tema.logo_url hoje serve tanto
-- de logo de empresa quanto de foto pessoal, sem nenhuma distinção — essa
-- informação já existe em profiles.tipo_usuario (dono/admin do tenant),
-- mas nunca chegou até tenants nem até a rota pública, que só consulta
-- tenants (evita depender de join com profiles a cada carregamento da
-- página pública).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tipo_tenant text;

-- Backfill dos tenants existentes: usa o tipo_usuario do profile do
-- primeiro admin (role='admin') vinculado ao tenant; se não achar nenhum
-- admin, usa o profile mais antigo do tenant; sem nenhum profile, assume
-- 'imobiliaria' (mantém o comportamento visual atual — logo no header —
-- como default seguro pra quem não conseguirmos classificar).
WITH dono AS (
  SELECT DISTINCT ON (ur.tenant_id)
    ur.tenant_id,
    p.tipo_usuario
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.tenant_id IS NOT NULL AND ur.role = 'admin'
  ORDER BY ur.tenant_id, ur.created_at ASC
),
fallback AS (
  SELECT DISTINCT ON (p.tenant_id)
    p.tenant_id,
    p.tipo_usuario
  FROM public.profiles p
  WHERE p.tenant_id IS NOT NULL
  ORDER BY p.tenant_id, p.created_at ASC
)
UPDATE public.tenants t
SET tipo_tenant = COALESCE(
  (SELECT tipo_usuario FROM dono WHERE dono.tenant_id = t.id),
  (SELECT tipo_usuario FROM fallback WHERE fallback.tenant_id = t.id),
  'imobiliaria'
)
WHERE t.tipo_tenant IS NULL;

-- Novos tenants (fora do fluxo de provision_trial_business, que já passa
-- p_tipo explicitamente): default seguro.
ALTER TABLE public.tenants ALTER COLUMN tipo_tenant SET DEFAULT 'imobiliaria';

-- provision_trial_business já recebe p_tipo ('corretor'|'imobiliaria') —
-- só passa a gravar esse valor também em tenants.tipo_tenant no INSERT.
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
