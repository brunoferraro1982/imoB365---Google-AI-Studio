-- CLM Sprint 8 — Gestão Documental: hoje não existe nada (nem bucket, nem
-- tabela, arquivo_path em contratos é coluna morta). Bucket NÃO público
-- (diferente de imovel-fotos/corretor-fotos) — são documentos pessoais
-- (RG/CPF/CNH), leitura exige sessão autenticada + membership do tenant.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contrato-documentos', 'contrato-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Path: {tenant_id}/{contrato_id}/{arquivo} — mesmo padrão de pasta já usado
-- em imovel-fotos/corretor-fotos, com is_member_of_tenant (não
-- has_role_in_tenant admin-only, esse foi o bug original naqueles buckets).
CREATE POLICY "contrato-documentos super_admin all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'contrato-documentos' AND has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'contrato-documentos' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "contrato-documentos member read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contrato-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "contrato-documentos member write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contrato-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "contrato-documentos member update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contrato-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "contrato-documentos member delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contrato-documentos'
    AND is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- Metadados do documento — categoria é text livre (validado em Zod no
-- client, mesmo padrão já usado pra locacao_garantias.tipo), não enum de
-- banco, pra não exigir migration a cada categoria nova.
CREATE TABLE public.contrato_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  storage_path text NOT NULL,
  nome_original text NOT NULL,
  tamanho_bytes bigint,
  versao integer NOT NULL DEFAULT 1,
  documento_anterior_id uuid REFERENCES public.contrato_documentos(id) ON DELETE SET NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contrato_documentos_contrato ON public.contrato_documentos(contrato_id);

ALTER TABLE public.contrato_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cd_read ON public.contrato_documentos
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY cd_write ON public.contrato_documentos
  FOR ALL TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY cd_super_admin_all ON public.contrato_documentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_documentos TO authenticated;

DROP TRIGGER IF EXISTS tg_audit_contrato_documentos ON public.contrato_documentos;
CREATE TRIGGER tg_audit_contrato_documentos
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- Sprint 7 (checklist) já criou contrato_checklist.documento_id sem FK,
-- porque esta tabela ainda não existia — fecha a referência agora.
ALTER TABLE public.contrato_checklist
  ADD CONSTRAINT contrato_checklist_documento_id_fkey
  FOREIGN KEY (documento_id) REFERENCES public.contrato_documentos(id) ON DELETE SET NULL;
