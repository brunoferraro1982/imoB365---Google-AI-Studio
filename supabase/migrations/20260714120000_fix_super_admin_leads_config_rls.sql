-- Bug na correção anterior (20260713150000): adicionei 'broker' às policies de
-- escrita de lead_funis, lead_funil_etapas, lead_scoring_regras, lead_cadencias
-- e lead_cadencia_steps, mas essas 5 tabelas NUNCA tiveram bypass de
-- super_admin (diferente de outras tabelas do projeto, que já tinham uma
-- policy "*_super_admin_all" separada). Resultado: mesmo com a correção
-- anterior aplicada, um usuário puramente super_admin (sem role 'admin' nem
-- 'broker' dentro do tenant — ex.: imob365br@gmail.com) continuava recebendo
-- "new row violates row-level security policy" ao clicar em "+" em Funis,
-- Lead Scoring ou Cadências. Confirmado testando com sessão real antes desta
-- correção.

DROP POLICY IF EXISTS "lf_admin" ON public.lead_funis;
CREATE POLICY "lf_admin" ON public.lead_funis
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

DROP POLICY IF EXISTS "lfe_admin" ON public.lead_funil_etapas;
CREATE POLICY "lfe_admin" ON public.lead_funil_etapas
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

DROP POLICY IF EXISTS "lsr_admin" ON public.lead_scoring_regras;
CREATE POLICY "lsr_admin" ON public.lead_scoring_regras
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

DROP POLICY IF EXISTS "lc_admin" ON public.lead_cadencias;
CREATE POLICY "lc_admin" ON public.lead_cadencias
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

DROP POLICY IF EXISTS "lcs_admin" ON public.lead_cadencia_steps;
CREATE POLICY "lcs_admin" ON public.lead_cadencia_steps
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
