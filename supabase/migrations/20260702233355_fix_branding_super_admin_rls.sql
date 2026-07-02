-- O bucket tenant-branding (logo/marca) nunca teve uma policy de bypass
-- para super_admin — diferente de tenant_site_settings e tenant_pages, que
-- já tinham "*_super_admin_all". Um super_admin só tem role 'super_admin'
-- (global e/ou por tenant), nunca 'admin'/'broker' dentro de um tenant
-- específico, então a policy anterior (só admin OU broker) também bloqueava
-- o próprio super_admin de enviar logo — reproduzido com imob365br@gmail.com,
-- que só tem role super_admin no tenant imob365.

CREATE POLICY "tenant_branding_super_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "tenant_branding_super_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "tenant_branding_super_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND has_role(auth.uid(), 'super_admin'::app_role)
  );
