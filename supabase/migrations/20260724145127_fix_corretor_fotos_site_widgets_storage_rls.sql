-- Achado de severidade Média da auditoria de segurança de 2026-07-24: mesmo
-- padrão dos bugs reais já corrigidos em imovel-fotos e tenant-branding
-- (20260625000001_fix_imovel_fotos_rls.sql, changelog de 2026-07-22) — os
-- buckets `corretor-fotos` (foto do corretor, app.corretores.$id.tsx) e
-- `site-widgets` (banner do widget "Banner publicitário",
-- app.site.widgets-conteudo.tsx) só tinham policy de SELECT público em
-- storage.objects, sem INSERT/UPDATE/DELETE. Confirmado no código que os
-- dois uploads são feitos direto pelo client (supabase.storage.from(...),
-- não via server function/service role) — ou seja, nunca funcionaram em
-- produção pra ninguém. Path layout dos dois: {tenant_id}/{arquivo}.

-- corretor-fotos — super_admin
CREATE POLICY "corretor-fotos super_admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'corretor-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "corretor-fotos super_admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "corretor-fotos super_admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- corretor-fotos — membros do tenant
CREATE POLICY "corretor-fotos member write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'corretor-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "corretor-fotos member update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "corretor-fotos member delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- site-widgets — super_admin
CREATE POLICY "site-widgets super_admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-widgets'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "site-widgets super_admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-widgets'
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "site-widgets super_admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-widgets'
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- site-widgets — membros do tenant
CREATE POLICY "site-widgets member write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-widgets'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "site-widgets member update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-widgets'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "site-widgets member delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-widgets'
    AND public.is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
