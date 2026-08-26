-- Bug real em produção: uma corretora com nome cadastrado em CAIXA ALTA
-- ("DANIELA CORREA FEIJO GUEDES FONSECA") teve tenants.slug e corretores.slug
-- gravados como string vazia pelo provision_trial_business() original — o
-- site dela ficou 100% publicado (tenant_site_settings.publicado=true, todo
-- o conteúdo preenchido) mas inacessível, porque /site/$slug busca o tenant
-- por slug ANTES de checar publicado, e nenhuma URL casa com slug=''.
--
-- Causa raiz: `lower(regexp_replace(translate(p_nome, ...), '[^a-z0-9]+', '-', 'g'))`
-- roda o regexp_replace (que só reconhece a-z0-9 minúsculo) ANTES do lower()
-- envolvente. Com o nome em maiúsculas, nenhum caractere casa com [a-z0-9] —
-- a string inteira vira um único bloco "inválido", vira um hífen, e o trim()
-- seguinte remove esse hífen por completo, resultando em ''. Não havia
-- fallback pra esse caso (só havia tratamento de colisão entre dois slugs
-- iguais). O mesmo v_slug quebrado também é usado para corretores.slug.
--
-- Fix: aplicar lower() ANTES do regexp_replace, e adicionar um fallback
-- explícito para v_slug='' (nome só com caracteres não-alfanuméricos, ou
-- qualquer outro caso residual).
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
  v_slug := regexp_replace(
    lower(translate(p_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn')),
    '[^a-z0-9]+', '-', 'g'
  );
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'tenant-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
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
