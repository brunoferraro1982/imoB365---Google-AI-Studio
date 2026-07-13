-- Funis, etapas de funil, regras de scoring e cadências só permitiam escrita
-- para role 'admin' no tenant. Corretores individuais (role 'broker' — donos
-- únicos do próprio tenant, nunca têm 'admin') recebiam
-- "new row violates row-level security policy" ao tentar criar/editar
-- qualquer um desses, mesmo sendo o único usuário do tenant.
--
-- Mesmo padrão de bug já corrigido em outras tabelas (ver
-- 20260702232316_fix_broker_site_wizard_rls.sql) — recriando as policies de
-- escrita para aceitar também role 'broker'.

DROP POLICY IF EXISTS "lf_admin" ON public.lead_funis;
CREATE POLICY "lf_admin" ON public.lead_funis
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "lfe_admin" ON public.lead_funil_etapas;
CREATE POLICY "lfe_admin" ON public.lead_funil_etapas
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "lsr_admin" ON public.lead_scoring_regras;
CREATE POLICY "lsr_admin" ON public.lead_scoring_regras
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "lc_admin" ON public.lead_cadencias;
CREATE POLICY "lc_admin" ON public.lead_cadencias
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "lcs_admin" ON public.lead_cadencia_steps;
CREATE POLICY "lcs_admin" ON public.lead_cadencia_steps
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

-- Mesmo bug em Webhooks e Chaves de API: um corretor individual (broker,
-- dono único do próprio tenant) não conseguia cadastrar webhook nem gerar
-- chave de API.
DROP POLICY IF EXISTS "admin tenant manage webhooks" ON public.tenant_webhooks;
CREATE POLICY "admin tenant manage webhooks" ON public.tenant_webhooks
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "api_keys_admin_all" ON public.tenant_api_keys;
CREATE POLICY "api_keys_admin_all" ON public.tenant_api_keys
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
