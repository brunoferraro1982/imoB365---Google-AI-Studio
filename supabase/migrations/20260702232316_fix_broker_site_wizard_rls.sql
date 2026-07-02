-- O módulo Site (tenant_site_settings, tenant_pages, logo em tenant-branding
-- e tenants.tema) só permitia escrita para quem tem role 'admin' no tenant.
-- Corretores individuais (role 'broker' — a persona principal do assistente
-- "Vamos criar seu site aqui") são o dono único do próprio tenant e nunca
-- têm role 'admin' atribuída, então não conseguiam salvar absolutamente
-- nada: nem o site público, nem páginas customizadas, nem a logo/marca em
-- /app/configuracoes/branding (bug pré-existente, não introduzido agora —
-- só foi descoberto ao testar o wizard com um usuário 'broker' de verdade
-- em vez de 'admin'/'super_admin').
--
-- Recriando as policies para aceitar também role 'broker', mantendo o
-- restrito para os dois papéis que fazem sentido gerenciar o site/marca.

DROP POLICY IF EXISTS "site_settings_admin_write" ON public.tenant_site_settings;
CREATE POLICY "site_settings_admin_write" ON public.tenant_site_settings
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "pages_admin_write" ON public.tenant_pages;
CREATE POLICY "pages_admin_write" ON public.tenant_pages
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "tenants_admin_update" ON public.tenants;
CREATE POLICY "tenants_admin_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), id, 'broker'::app_role)
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), id, 'broker'::app_role)
  );

DROP POLICY IF EXISTS "tenant_branding_admin_write" ON storage.objects;
CREATE POLICY "tenant_branding_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (
      has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'broker'::app_role)
    )
  );

DROP POLICY IF EXISTS "tenant_branding_admin_update" ON storage.objects;
CREATE POLICY "tenant_branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (
      has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'broker'::app_role)
    )
  );

DROP POLICY IF EXISTS "tenant_branding_admin_delete" ON storage.objects;
CREATE POLICY "tenant_branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (
      has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'broker'::app_role)
    )
  );
