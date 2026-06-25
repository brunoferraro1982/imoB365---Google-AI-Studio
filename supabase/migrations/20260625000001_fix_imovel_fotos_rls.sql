-- Fix: imovel_fotos e storage policies muito restritivas
-- Problema: só admin podia escrever; super_admin e broker ficavam bloqueados
-- Solução: adicionar policies para broker (membro do tenant) e super_admin no storage

-- =========================================================
-- 1. imovel_fotos — broker pode gerenciar fotos do tenant
-- =========================================================
CREATE POLICY imovel_fotos_broker_write ON public.imovel_fotos
  FOR ALL TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_member_of_tenant(auth.uid(), tenant_id));

-- =========================================================
-- 2. imoveis — broker pode criar/editar imóveis do tenant
-- =========================================================
CREATE POLICY imoveis_broker_write ON public.imoveis
  FOR ALL TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_member_of_tenant(auth.uid(), tenant_id));

-- =========================================================
-- 3. Storage bucket imovel-fotos — super_admin full access
-- =========================================================
CREATE POLICY "imovel-fotos super_admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imovel-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "imovel-fotos super_admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "imovel-fotos super_admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- =========================================================
-- 4. Storage bucket imovel-fotos — membros do tenant podem fazer upload
--    Path layout: {tenant_id}/{imovel_id}/{filename}
-- =========================================================
CREATE POLICY "imovel-fotos member write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imovel-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "imovel-fotos member update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "imovel-fotos member delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
