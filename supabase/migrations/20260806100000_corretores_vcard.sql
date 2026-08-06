-- Cartão Virtual do corretor: redes sociais (exibidas na página pública
-- /corretor/$slug) + CIRP (carteira do CRECI, documento pessoal — NUNCA
-- público, mesma regra já usada em contrato_documentos: bucket privado,
-- acesso só via signed URL de curta duração).
ALTER TABLE public.corretores
  ADD COLUMN instagram text,
  ADD COLUMN facebook text,
  ADD COLUMN linkedin text,
  ADD COLUMN site text,
  ADD COLUMN cirp_storage_path text,
  ADD COLUMN cirp_enviado_em timestamptz;

-- Bucket privado — espelha exatamente contrato-documentos (mesma migration
-- de referência: 20260728210000_contratos_clm_sprint8_gestao_documental.sql).
-- Path: {tenant_id}/{corretor_id}/{arquivo}.
INSERT INTO storage.buckets (id, name, public)
VALUES ('corretor-documentos', 'corretor-documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "corretor-documentos super_admin all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'corretor-documentos' AND has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'corretor-documentos' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "corretor-documentos member read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'corretor-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "corretor-documentos member write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'corretor-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "corretor-documentos member update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'corretor-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "corretor-documentos member delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'corretor-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));
