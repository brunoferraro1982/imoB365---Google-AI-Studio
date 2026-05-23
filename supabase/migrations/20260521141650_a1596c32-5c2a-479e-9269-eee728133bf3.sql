-- Corretores
CREATE TABLE public.corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  nome text NOT NULL,
  email text,
  telefone text,
  whatsapp text,
  creci text,
  creci_uf text,
  foto_url text,
  bio text,
  slug text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  publico boolean NOT NULL DEFAULT true,
  comissao_padrao numeric,
  cargo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_corretores_tenant ON public.corretores(tenant_id);
CREATE INDEX idx_corretores_user ON public.corretores(user_id);

ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;

CREATE POLICY corretores_super_admin_all ON public.corretores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY corretores_admin_write ON public.corretores
  FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY corretores_members_read ON public.corretores
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY corretores_self_update ON public.corretores
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY corretores_public_read ON public.corretores
  FOR SELECT TO anon, authenticated
  USING (ativo = true AND publico = true);

CREATE TRIGGER tg_corretores_updated_at
  BEFORE UPDATE ON public.corretores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket for fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('corretor-fotos', 'corretor-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "corretor_fotos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'corretor-fotos');

CREATE POLICY "corretor_fotos_tenant_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'corretor-fotos'
    AND has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
  );

CREATE POLICY "corretor_fotos_tenant_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
  );

CREATE POLICY "corretor_fotos_tenant_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'corretor-fotos'
    AND has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::app_role)
  );