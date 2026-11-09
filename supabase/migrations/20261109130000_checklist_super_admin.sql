-- Super admin também gerencia os modelos de checklist (dentro do tenant que estiver
-- operando). Antes a regra só aceitava admin e jurídico do tenant.
DROP POLICY IF EXISTS ct_gestao ON public.checklist_templates;
CREATE POLICY ct_gestao ON public.checklist_templates TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  );

DROP POLICY IF EXISTS cti_gestao ON public.checklist_template_itens;
CREATE POLICY cti_gestao ON public.checklist_template_itens TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  );
