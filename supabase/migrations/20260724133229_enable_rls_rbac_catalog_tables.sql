-- Achado crítico da auditoria de segurança de 2026-07-24: plan_features,
-- plan_modules, profile_permissions e user_profiles nunca tiveram uma
-- migration própria (criadas fora do fluxo normal, mesmo padrão de drift já
-- documentado no CLAUDE.md pra outros objetos) e por isso nunca ganharam RLS
-- — com os grants padrão do Supabase pra anon/authenticated, qualquer
-- visitante anônimo podia INSERT/UPDATE/DELETE nessas tabelas globais de
-- RBAC, afetando todos os tenants de uma vez.
--
-- São catálogos de referência (plano->feature, plano->módulo, perfil->
-- permissão, catálogo de perfis), sem tenant_id — leitura pública é o
-- comportamento esperado (a aplicação lê essa matriz pra decidir o que
-- exibir), mas escrita deve ser restrita a super_admin.

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- plan_features
CREATE POLICY "plan_features_public_read" ON public.plan_features
  FOR SELECT
  USING (true);

CREATE POLICY "plan_features_super_admin_write" ON public.plan_features
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "plan_features_super_admin_update" ON public.plan_features
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "plan_features_super_admin_delete" ON public.plan_features
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- plan_modules
CREATE POLICY "plan_modules_public_read" ON public.plan_modules
  FOR SELECT
  USING (true);

CREATE POLICY "plan_modules_super_admin_write" ON public.plan_modules
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "plan_modules_super_admin_update" ON public.plan_modules
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "plan_modules_super_admin_delete" ON public.plan_modules
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- profile_permissions
CREATE POLICY "profile_permissions_public_read" ON public.profile_permissions
  FOR SELECT
  USING (true);

CREATE POLICY "profile_permissions_super_admin_write" ON public.profile_permissions
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "profile_permissions_super_admin_update" ON public.profile_permissions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "profile_permissions_super_admin_delete" ON public.profile_permissions
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- user_profiles (catálogo de perfis, ex: perfil-corretor, perfil-adm-imob)
CREATE POLICY "user_profiles_public_read" ON public.user_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "user_profiles_super_admin_write" ON public.user_profiles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user_profiles_super_admin_update" ON public.user_profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user_profiles_super_admin_delete" ON public.user_profiles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));
