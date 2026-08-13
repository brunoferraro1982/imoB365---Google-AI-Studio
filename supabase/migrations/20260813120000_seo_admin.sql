-- Fase 2 do SEO: área editável no super admin (/admin/seo). Guarda overrides de
-- meta POR PÁGINA (seo_pages) + config global de SEO (global_settings chave
-- seo_global). As rotas públicas leem esses valores pra montar o <head> sem
-- precisar de deploy a cada ajuste. Campos vazios = a rota usa o default do código.

-- ── Overrides por página ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  title text,
  description text,
  canonical text,
  noindex boolean NOT NULL DEFAULT false,
  og_image text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

-- Leitura pública: as rotas públicas leem os overrides pra montar o head.
DROP POLICY IF EXISTS seo_pages_public_read ON public.seo_pages;
CREATE POLICY seo_pages_public_read ON public.seo_pages FOR SELECT USING (true);

-- Escrita só super_admin.
DROP POLICY IF EXISTS seo_pages_super_admin_write ON public.seo_pages;
CREATE POLICY seo_pages_super_admin_write ON public.seo_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- GRANT explícito nos 3 roles — lição já registrada: tabela criada via psql
-- direto (SSH) não herda o ALTER DEFAULT PRIVILEGES deste self-host.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_pages TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS seo_pages_upd ON public.seo_pages;
CREATE TRIGGER seo_pages_upd BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed dos paths institucionais conhecidos (vazios = usam o default do código;
-- só pré-populam a lista da tela do admin).
INSERT INTO public.seo_pages (path) VALUES
  ('/'), ('/planos'), ('/contato'), ('/a-imob365'), ('/consultoria'),
  ('/plataforma'), ('/blog'), ('/calculadoras')
ON CONFLICT (path) DO NOTHING;

-- ── Config global de SEO (global_settings, chave seo_global) ─────────────────
-- Leitura pública restrita A ESSA CHAVE (mesmo padrão do vitrine_marquee); as
-- policies de INSERT/UPDATE super_admin e o GRANT já existem da migration
-- 20260811120100_global_settings_vitrine.sql.
DROP POLICY IF EXISTS global_settings_public_read_seo ON public.global_settings;
CREATE POLICY global_settings_public_read_seo ON public.global_settings
  FOR SELECT USING (key = 'seo_global');

INSERT INTO public.global_settings (key, value)
VALUES (
  'seo_global',
  '{"brand_name":"imob365","default_og_image":"","search_action_target":"https://portal.imob365.com.br/buscar?q={search_term_string}","gsc_verification":"","org":{"url":"https://portal.imob365.com.br","areaServed":"BR","description":""}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
