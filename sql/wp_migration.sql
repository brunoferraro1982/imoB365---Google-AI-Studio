-- =============================================================================
-- imoB365 — WordPress Content Migration SQL
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. blog_posts (importados do WordPress + futuros posts nativos)
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        REFERENCES public.tenants(id) ON DELETE CASCADE,
  wp_id           integer     UNIQUE,            -- ID original do WordPress (evita duplicatas)
  slug            text        NOT NULL UNIQUE,
  titulo          text        NOT NULL,
  excerpt         text,
  conteudo_html   text,                          -- HTML do WordPress
  conteudo_mdx    text,                          -- futuro: Markdown nativo
  imagem_capa_url text,
  autor_nome      text,
  categorias      text[]      DEFAULT '{}',      -- ex: ['investidor','renda']
  tags            text[]      DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('published','draft','archived')),
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_posts_public_read"   ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "blog_posts_admin_manage"  ON public.blog_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx       ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_categorias_idx  ON public.blog_posts USING GIN(categorias);

-- 2. newsletter_subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  email       text        NOT NULL,
  nome        text,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','unsubscribed','bounced')),
  source      text        DEFAULT 'portal',      -- 'portal','blog','footer'
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_admin_read"   ON public.newsletter_subscribers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));
CREATE POLICY "newsletter_anon_insert"  ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);

-- 3. testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES public.tenants(id),
  nome          text        NOT NULL,
  cargo         text,
  empresa       text,
  depoimento    text        NOT NULL,
  foto_url      text,
  ordem         integer     DEFAULT 0,
  ativo         boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "testimonials_public_read"   ON public.testimonials FOR SELECT USING (ativo = true);
CREATE POLICY "testimonials_admin_manage"  ON public.testimonials FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 4. partners (construtoras parceiras)
CREATE TABLE IF NOT EXISTS public.partners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  nome        text        NOT NULL,
  logo_url    text,
  site_url    text,
  ordem       integer     DEFAULT 0,
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_public_read"   ON public.partners FOR SELECT USING (ativo = true);
CREATE POLICY "partners_admin_manage"  ON public.partners FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 5. services (página consultoria)
CREATE TABLE IF NOT EXISTS public.services (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  titulo      text        NOT NULL,
  descricao   text,
  icone_url   text,
  ordem       integer     DEFAULT 0,
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read"   ON public.services FOR SELECT USING (ativo = true);
CREATE POLICY "services_admin_manage"  ON public.services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 6. Seed: depoimentos do WordPress
-- (substitua tenant_id pelo UUID real do Tenant 0)
DO $$
DECLARE t_id uuid;
BEGIN
  SELECT id INTO t_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF t_id IS NOT NULL THEN
    INSERT INTO public.testimonials (tenant_id, nome, cargo, empresa, depoimento, ordem) VALUES
    (t_id, 'Ricardo M.', 'Diretor Financeiro (CFO)', NULL,
     'Como investidor no setor imobiliário há anos, busco parceiros que compreendam a diferença entre preço e valor. A consultoria da imoB365 se destaca pela curadoria rigorosa e pelo profundo conhecimento do mercado de alto padrão no Litoral Sul de São Paulo.', 1),
    (t_id, 'Dra. Helena S.', 'Consultora de Investimentos', NULL,
     'O diferencial da imoB365 está na abordagem analítica. Em vez de argumentos genéricos, recebi projeções de valorização e estudos de vacância detalhados para a região de Praia Grande.', 2),
    (t_id, 'André V.', 'Empresário', 'Setor de Tecnologia',
     'Minha experiência com a gestão imobiliária da imoB365 tem sido impecável. A administração garante que o patrimônio seja gerido com eficiência máxima e burocracia mínima.', 3),
    (t_id, 'Beatriz F.', 'Executiva', 'Multinacional',
     'O atendimento personalizado da imoB365 é sob medida para o público de alto padrão. Eles entenderam perfeitamente meu perfil, filtrando apenas oportunidades reais de frente para o mar.', 4)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.services (tenant_id, titulo, descricao, ordem) VALUES
    (t_id, 'Administração de Imóveis', 'Administramos seu imóvel para que tenha tranquilidade jurídica.', 1),
    (t_id, 'Gestão Contratual', 'Gestão, elaboração e administração contratual.', 2),
    (t_id, 'Consultoria', 'Parceria imobiliária e com corretores em administração.', 3),
    (t_id, 'Lançamentos', 'Exclusividade para imóveis de alto padrão.', 4),
    (t_id, 'Imóveis Mobiliados', 'Adquira seu imóvel e não se preocupe com a decoração.', 5),
    (t_id, 'Imóveis de Alto Padrão', 'Carteira exclusiva com imóveis de alto padrão em toda região.', 6)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 7. Adicionar coluna investment_tags nos imóveis (filtro por intenção)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS investment_tags text[] DEFAULT '{}';
COMMENT ON COLUMN public.imoveis.investment_tags IS
  'Tags de intenção: investidor, renda, planta, litoral-sul';
CREATE INDEX IF NOT EXISTS imoveis_investment_tags_idx ON public.imoveis USING GIN(investment_tags);

-- Done
