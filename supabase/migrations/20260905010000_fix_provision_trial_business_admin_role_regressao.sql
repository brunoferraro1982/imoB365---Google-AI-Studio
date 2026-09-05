-- Bug real de produção: corretor autônomo Enzo Ferracioli, cadastrado
-- 2026-09-04, ficou só com role 'broker' no próprio tenant — sem 'admin',
-- não conseguiu salvar a própria foto em /conta/perfil (bloqueado pela
-- RLS tenants_admin_update, que exige admin desde 2026-07-24).
--
-- Causa raiz: a migration 20260728280000_fix_corretor_autonomo_admin_role
-- já tinha corrigido isso (corretor autônomo recebe 'admin' ALÉM de
-- 'broker'), mas a migration seguinte que tocou esta função
-- (20260826140000_fix_provision_trial_business_slug_bug, que corrigia um
-- bug de slug em maiúsculas) foi escrita em cima de uma cópia desatualizada
-- do corpo da função — sem querer, reverteu o fix de role ao recriar a
-- função inteira. Confirmado comparando tenants cadastrados antes (Daniela,
-- 2026-08-18, tem admin) e depois (Enzo, 2026-09-04, só tinha broker) dessa
-- migration.
--
-- Fix: mesmo corpo da função (já com a correção de slug de 20260826140000
-- preservada), com o INSERT de user_roles voltando a inserir os DOIS
-- roles pra corretor autônomo.
--
-- Lição operacional: quando uma função SQL recebe várias correções ao
-- longo do tempo via CREATE OR REPLACE em migrations separadas, escrever a
-- migration seguinte sempre a partir do dump/definição ATUAL do banco
-- (não de uma cópia local desatualizada do arquivo), ou revisar explicitamente
-- se algum fix anterior está sendo silenciosamente descartado.
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

  -- Quem não é imobiliária (corretor autônomo) é o único usuário do
  -- próprio tenant — sem admin, ninguém tem controle administrativo sobre
  -- a própria conta (Financeiro, Configurações, RLS de tenants exigem
  -- admin). Imobiliária mantém o comportamento original: só admin, sem
  -- broker. Seguro inserir os dois papéis pro corretor autônomo porque
  -- user_roles não tem UNIQUE(user_id,tenant_id), só (user_id,tenant_id,role).
  IF p_tipo = 'imobiliaria' THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (p_user_id, v_tenant_id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (p_user_id, v_tenant_id, 'broker'::app_role)
    ON CONFLICT DO NOTHING;
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
