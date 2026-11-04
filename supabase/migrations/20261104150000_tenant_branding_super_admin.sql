-- Super admin pode enviar/trocar/remover o logo (ou foto do corretor autônomo)
-- de QUALQUER tenant no bucket tenant-branding — usado pela tela
-- /admin/tenants/$id (edição de perfil das imobiliárias pelo super_admin).
-- Hoje o bucket só aceita escrita de admin/broker do próprio tenant
-- (has_role_in_tenant na pasta = tenant_id). Mesmo padrão das policies
-- "corretor-fotos super_admin *" (20260724145127).

DROP POLICY IF EXISTS "tenant-branding super_admin write" ON storage.objects;
CREATE POLICY "tenant-branding super_admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "tenant-branding super_admin update" ON storage.objects;
CREATE POLICY "tenant-branding super_admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "tenant-branding super_admin delete" ON storage.objects;
CREATE POLICY "tenant-branding super_admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND public.has_role(auth.uid(), 'super_admin')
  );
