-- lead_admin_write só liberava INSERT/UPDATE/DELETE em leads para role
-- 'admin', excluindo 'broker' (corretor individual). Isso bloqueava, por
-- exemplo, a importação de leads via CSV (/app/configuracoes/importar)
-- para qualquer tenant cujo único usuário seja um corretor individual.
DROP POLICY IF EXISTS "leads_admin_write" ON public.leads;
CREATE POLICY "leads_admin_write" ON public.leads
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );
