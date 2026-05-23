
-- Enums
CREATE TYPE public.imovel_finalidade AS ENUM ('venda', 'aluguel', 'temporada');
CREATE TYPE public.imovel_tipo AS ENUM ('apartamento','casa','casa_condominio','sobrado','cobertura','flat','kitnet','terreno','sitio','chacara','fazenda','comercial_sala','comercial_loja','comercial_galpao','comercial_predio','outro');
CREATE TYPE public.imovel_status AS ENUM ('rascunho','ativo','inativo','vendido','alugado','reservado');

-- imoveis
CREATE TABLE public.imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  codigo_interno text,
  titulo text NOT NULL,
  descricao text,
  finalidade public.imovel_finalidade NOT NULL DEFAULT 'venda',
  tipo public.imovel_tipo NOT NULL DEFAULT 'apartamento',
  status public.imovel_status NOT NULL DEFAULT 'rascunho',
  preco numeric(14,2) NOT NULL DEFAULT 0,
  condominio numeric(14,2),
  iptu numeric(14,2),
  area_total numeric(10,2),
  area_util numeric(10,2),
  quartos int,
  suites int,
  banheiros int,
  vagas int,
  endereco_cep text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  latitude double precision,
  longitude double precision,
  mostrar_endereco_publico boolean NOT NULL DEFAULT false,
  aceita_financiamento boolean NOT NULL DEFAULT false,
  aceita_permuta boolean NOT NULL DEFAULT false,
  caracteristicas text[] NOT NULL DEFAULT '{}',
  corretor_responsavel_id uuid,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_imoveis_tenant ON public.imoveis(tenant_id);
CREATE INDEX idx_imoveis_publicado ON public.imoveis(publicado) WHERE publicado = true;
CREATE INDEX idx_imoveis_cidade ON public.imoveis(endereco_cidade, endereco_uf);
CREATE INDEX idx_imoveis_finalidade_tipo ON public.imoveis(finalidade, tipo);

CREATE TRIGGER imoveis_set_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- imovel_fotos
CREATE TABLE public.imovel_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  capa boolean NOT NULL DEFAULT false,
  legenda text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_imovel_fotos_imovel ON public.imovel_fotos(imovel_id, ordem);

-- imovel_portais
CREATE TABLE public.imovel_portais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  portal_slug text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  external_id text,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(imovel_id, portal_slug)
);

CREATE TRIGGER imovel_portais_set_updated_at
  BEFORE UPDATE ON public.imovel_portais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imovel_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imovel_portais ENABLE ROW LEVEL SECURITY;

-- imoveis policies
CREATE POLICY imoveis_public_read ON public.imoveis
  FOR SELECT TO anon, authenticated
  USING (publicado = true AND status = 'ativo');

CREATE POLICY imoveis_members_read ON public.imoveis
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY imoveis_admin_write ON public.imoveis
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY imoveis_super_admin_all ON public.imoveis
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- imovel_fotos policies
CREATE POLICY imovel_fotos_public_read ON public.imovel_fotos
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.imoveis i
    WHERE i.id = imovel_fotos.imovel_id AND i.publicado = true AND i.status = 'ativo'
  ));

CREATE POLICY imovel_fotos_members_read ON public.imovel_fotos
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY imovel_fotos_admin_write ON public.imovel_fotos
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY imovel_fotos_super_admin_all ON public.imovel_fotos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- imovel_portais policies
CREATE POLICY imovel_portais_members_read ON public.imovel_portais
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY imovel_portais_admin_write ON public.imovel_portais
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY imovel_portais_super_admin_all ON public.imovel_portais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Storage bucket for imovel fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('imovel-fotos', 'imovel-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout = {tenant_id}/{imovel_id}/{filename}
CREATE POLICY "imovel-fotos public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'imovel-fotos');

CREATE POLICY "imovel-fotos admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imovel-fotos'
    AND public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );

CREATE POLICY "imovel-fotos admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );

CREATE POLICY "imovel-fotos admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imovel-fotos'
    AND public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );
