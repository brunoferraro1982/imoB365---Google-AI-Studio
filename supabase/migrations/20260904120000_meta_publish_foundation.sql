-- Fundação para publicação ativa de conteúdo (Post/Story) no Facebook/
-- Instagram a partir de um imóvel — hoje a integração Meta só cobre
-- catálogo passivo (feed CSV) e recepção de Lead Ads via webhook.

-- tenant_meta_connections nunca guardou o id da conta comercial do
-- Instagram vinculada à Página (só o Facebook Page em si) — sem isso não
-- dá pra publicar no Instagram via Graph API.
ALTER TABLE public.tenant_meta_connections
  ADD COLUMN IF NOT EXISTS instagram_business_account_id text;

CREATE TYPE public.social_post_tipo AS ENUM ('post', 'story');
CREATE TYPE public.social_post_rede AS ENUM ('facebook', 'instagram');
CREATE TYPE public.social_post_status AS ENUM ('pendente', 'publicado', 'erro');

-- Modelos prontos selecionáveis (não editor livre) — cada modelo é a MESMA
-- função de renderização (src/lib/imageTemplates.ts), variando só `config`
-- (cores/layout). Catálogo de referência, mesmo padrão de RLS já usado em
-- plan_features/plan_modules (leitura pública, escrita só super_admin).
CREATE TABLE public.social_post_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_post public.social_post_tipo NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_post_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_post_templates_public_read ON public.social_post_templates
  FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY social_post_templates_super_admin_write ON public.social_post_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT ON public.social_post_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_templates TO service_role;

INSERT INTO public.social_post_templates (nome, tipo_post, config, ordem) VALUES
  ('Clássico', 'post', '{"layout":"classico","overlay":"faixa_inferior"}'::jsonb, 0),
  ('Moderno', 'post', '{"layout":"moderno","overlay":"gradiente_diagonal"}'::jsonb, 1),
  ('Minimalista', 'post', '{"layout":"minimalista","overlay":"moldura"}'::jsonb, 2),
  ('Clássico', 'story', '{"layout":"classico","overlay":"faixa_inferior"}'::jsonb, 0),
  ('Moderno', 'story', '{"layout":"moderno","overlay":"gradiente_diagonal"}'::jsonb, 1),
  ('Minimalista', 'story', '{"layout":"minimalista","overlay":"moldura"}'::jsonb, 2);

-- Auditoria de toda tentativa de publicação (sucesso ou erro) — histórico +
-- base pra não publicar o mesmo imóvel 2x sem querer. FKs/índices já
-- corretos desde a criação (lição do incidente de FK órfã desta sessão).
CREATE TABLE public.imovel_social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  rede public.social_post_rede NOT NULL,
  tipo_post public.social_post_tipo NOT NULL,
  template_id uuid REFERENCES public.social_post_templates(id) ON DELETE SET NULL,
  legenda text,
  media_public_url text,
  external_post_id text,
  status public.social_post_status NOT NULL DEFAULT 'pendente',
  erro_mensagem text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_imovel_social_posts_tenant ON public.imovel_social_posts(tenant_id);
CREATE INDEX idx_imovel_social_posts_imovel ON public.imovel_social_posts(imovel_id, created_at DESC);

ALTER TABLE public.imovel_social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY imovel_social_posts_members_read ON public.imovel_social_posts
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY imovel_social_posts_write ON public.imovel_social_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );
CREATE POLICY imovel_social_posts_super_admin_all ON public.imovel_social_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT ON public.imovel_social_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_social_posts TO service_role;
