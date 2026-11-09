-- Gestão dos modelos de checklist (checklist_templates / checklist_template_itens)
-- passa a ser permitida ao papel jurídico, igual às tabelas de contratos.
-- Antes só o admin do tenant podia criar/editar modelos, e o usuário do Jurídico
-- recebia "new row violates row-level security policy".

DROP POLICY IF EXISTS ct_admin ON public.checklist_templates;
CREATE POLICY ct_gestao ON public.checklist_templates TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  );

DROP POLICY IF EXISTS cti_admin ON public.checklist_template_itens;
CREATE POLICY cti_gestao ON public.checklist_template_itens TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
  );
