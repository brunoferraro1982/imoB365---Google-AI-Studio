-- ============================================================
-- imoB365 — Migration: Módulos, Features e Plano×Módulo
-- Sprint 1 | 2026-06-22 (v3 — schema real confirmado)
--
-- Schema real da tabela modules (confirmado 22/06/2026):
--   modules(slug TEXT PK, nome TEXT, descricao TEXT,
--           requires_plan TEXT, core BOOLEAN)
--
-- Esta migration:
--   1. Adiciona colunas de hierarquia à modules existente (idempotente)
--   2. Upsert dos macro-módulos e features usando slug + nome
--   3. Cria plan_modules e plan_features com FK modules(slug)
--   4. Trigger fn_auto_plan_features
--   5. Seed por plano (slugs reais: free, basic, standard, pro, business)
-- ============================================================

-- ── 1. Adicionar colunas de hierarquia (idempotente) ─────────────────────
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS parent_slug TEXT REFERENCES public.modules(slug) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Upsert macro-módulos ───────────────────────────────────────────────
-- Usa slugs consistentes com os já existentes no banco (imobiliario, etc.)
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, sort_order, is_active)
VALUES
  ('imobiliario', '1. Imobiliário — Gestão de Propriedades & Leads',
   'Cadastro de imóveis, pipeline de leads, agendamentos e chat', 'free', TRUE, 1, TRUE),
  ('financeiro',  '2. Financeiro — Comissões & Faturamento',
   'Comissões, centro de custo, NF-e e relatórios', 'standard', TRUE, 2, TRUE),
  ('marketing',   '3. Marketing — Campanhas & Distribuição',
   'Portal white-label, blog, feed multi-portal e automações', 'basic', TRUE, 3, TRUE),
  ('juridico',    '4. Jurídico — Contratos & Compliance',
   'Modelos de contrato, assinatura digital e checklist', 'standard', TRUE, 4, TRUE),
  ('elearning',   '5. E-Learning — Capacitação de Corretores',
   'Cursos, certificações e trilhas de aprendizado', 'free', TRUE, 5, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  nome        = EXCLUDED.nome,
  sort_order  = EXCLUDED.sort_order,
  is_active   = TRUE;

-- ── 3. Upsert features: Imobiliário ──────────────────────────────────────
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, parent_slug, sort_order)
VALUES
  ('imob-cad',      'Cadastro e edição de imóveis',            'Criar e editar fichas de imóveis',   'free', FALSE, 'imobiliario', 1),
  ('imob-galeria',  'Galeria de fotos (FotosManager)',          'Upload e gestão de fotos',           'free', FALSE, 'imobiliario', 2),
  ('imob-leads',    'Pipeline de leads (Kanban)',               'Gestão visual de leads',             'free', FALSE, 'imobiliario', 3),
  ('imob-hist',     'Histórico de lead',                        'Detalhes e linha do tempo do lead',  'free', FALSE, 'imobiliario', 4),
  ('imob-chat',     'Chat em tempo real com leads',             'Mensagens instantâneas',             'basic', FALSE, 'imobiliario', 5),
  ('imob-agenda',   'Agendamento de visitas',                   'Agenda e calendário de visitas',     'basic', FALSE, 'imobiliario', 6),
  ('imob-nps',      'Avaliação pós-visita',                     'NPS e feedback do cliente',          'standard', FALSE, 'imobiliario', 7),
  ('imob-comp',     'Comparação entre imóveis',                 'Side-by-side de imóveis',            'standard', FALSE, 'imobiliario', 8)
ON CONFLICT (slug) DO UPDATE SET
  nome        = EXCLUDED.nome,
  parent_slug = EXCLUDED.parent_slug,
  sort_order  = EXCLUDED.sort_order;

-- ── 4. Upsert features: Financeiro ───────────────────────────────────────
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, parent_slug, sort_order)
VALUES
  ('fin-calc',  'Cálculo de comissões',         'Cálculo automático por transação',  'standard', FALSE, 'financeiro', 1),
  ('fin-cc',    'Centro de custo',              'Classificação de despesas',          'standard', FALSE, 'financeiro', 2),
  ('fin-contas','Plano de contas',              'Estrutura contábil',                 'standard', FALSE, 'financeiro', 3),
  ('fin-nf',    'Emissão de recibos/NF-e',      'Documentos fiscais',                'pro',      FALSE, 'financeiro', 4),
  ('fin-dash',  'Dashboard de faturamento',     'Visão executiva financeira',         'standard', FALSE, 'financeiro', 5),
  ('fin-rel',   'Relatórios financeiros',       'Relatórios detalhados',              'pro',      FALSE, 'financeiro', 6)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, parent_slug = EXCLUDED.parent_slug;

-- ── 5. Upsert features: Marketing ────────────────────────────────────────
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, parent_slug, sort_order)
VALUES
  ('mkt-portal', 'Portal de anúncios (white-label)', 'Site próprio por tenant',               'basic',    FALSE, 'marketing', 1),
  ('mkt-blog',   'Blog integrado',                   'Posts e páginas SEO',                   'basic',    FALSE, 'marketing', 2),
  ('mkt-mult',   'Feed multi-portal',                'VivaReal, ZAP, OLX via XML',            'standard', FALSE, 'marketing', 3),
  ('mkt-brand',  'Branding (logo, cores, domínios)', 'Identidade visual por tenant',           'free',     FALSE, 'marketing', 4),
  ('mkt-url',    'Encurtador de URLs',               'Links curtos rastreáveis',              'basic',    FALSE, 'marketing', 5),
  ('mkt-aut',    'Automação de cadências',            'Em desenvolvimento — desabilitado',     'pro',      FALSE, 'marketing', 6)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, parent_slug = EXCLUDED.parent_slug;

-- ── 6. Upsert features: Jurídico ─────────────────────────────────────────
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, parent_slug, sort_order)
VALUES
  ('juri-lib',    'Biblioteca de contratos',    'Modelos prontos editáveis',          'standard', FALSE, 'juridico', 1),
  ('juri-gerador','Gerador de contratos',       'Geração automática por variáveis',   'standard', FALSE, 'juridico', 2),
  ('juri-assina', 'Assinatura digital',         'ClickSign / D4Sign integrado',       'pro',      FALSE, 'juridico', 3),
  ('juri-cart',   'Gestão de cartórios',        'Controle de registro',               'pro',      FALSE, 'juridico', 4),
  ('juri-check',  'Checklist de documentação',  'Documentos obrigatórios por tipo',   'standard', FALSE, 'juridico', 5),
  ('juri-vers',   'Versionamento de contratos', 'Histórico de versões',               'pro',      FALSE, 'juridico', 6)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, parent_slug = EXCLUDED.parent_slug;

-- ── 7. Upsert features: E-Learning ───────────────────────────────────────
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core, parent_slug, sort_order)
VALUES
  ('elearn-cursos','Plataforma de cursos',   'Catálogo de cursos TTI',           'free',  FALSE, 'elearning', 1),
  ('elearn-modelo','Modelos de cursos',      'Templates de conteúdo EAD',        'basic', FALSE, 'elearning', 2),
  ('elearn-adm',   'Admin de e-learning',   'Gestão de turmas e alunos',         'pro',   FALSE, 'elearning', 3),
  ('elearn-cert',  'Certificações e badges','Emissão de certificados',           'basic', FALSE, 'elearning', 4)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, parent_slug = EXCLUDED.parent_slug;

-- ── 8. Tabelas plan_modules e plan_features ──────────────────────────────
CREATE TABLE IF NOT EXISTS plan_modules (
  plano_slug   TEXT NOT NULL REFERENCES public.plans(slug)   ON DELETE CASCADE,
  module_slug  TEXT NOT NULL REFERENCES public.modules(slug) ON DELETE CASCADE,
  included     BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plano_slug, module_slug)
);

CREATE TABLE IF NOT EXISTS plan_features (
  plano_slug    TEXT NOT NULL REFERENCES public.plans(slug)   ON DELETE CASCADE,
  feature_slug  TEXT NOT NULL REFERENCES public.modules(slug) ON DELETE CASCADE,
  included      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plano_slug, feature_slug)
);

-- ── 9. Trigger: liberar módulo → liberar automaticamente features ─────────
CREATE OR REPLACE FUNCTION fn_auto_plan_features()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.included = TRUE THEN
    INSERT INTO plan_features (plano_slug, feature_slug, included)
    SELECT NEW.plano_slug, m.slug, TRUE
    FROM public.modules m
    WHERE m.parent_slug = NEW.module_slug
    ON CONFLICT (plano_slug, feature_slug) DO UPDATE SET included = TRUE;
  ELSE
    UPDATE plan_features SET included = FALSE
    WHERE plano_slug = NEW.plano_slug
      AND feature_slug IN (
        SELECT slug FROM public.modules WHERE parent_slug = NEW.module_slug
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_plan_features ON plan_modules;
CREATE TRIGGER trg_auto_plan_features
  AFTER INSERT OR UPDATE ON plan_modules
  FOR EACH ROW EXECUTE FUNCTION fn_auto_plan_features();

-- ── 10. Seed plan_modules por plano ──────────────────────────────────────
-- Free
INSERT INTO plan_modules (plano_slug, module_slug, included) VALUES
  ('free', 'imobiliario', TRUE), ('free', 'marketing',  FALSE),
  ('free', 'financeiro',  FALSE),('free', 'juridico',   FALSE),
  ('free', 'elearning',   TRUE)
ON CONFLICT (plano_slug, module_slug) DO UPDATE SET included = EXCLUDED.included;

-- Restringir features do Free após trigger
UPDATE plan_features SET included = FALSE
WHERE plano_slug = 'free'
  AND feature_slug IN ('imob-chat','imob-agenda','imob-nps','imob-comp',
                        'elearn-adm','elearn-modelo');

-- Free: mkt-brand incluso mesmo sem módulo marketing
INSERT INTO plan_features (plano_slug, feature_slug, included)
VALUES ('free','mkt-brand',TRUE)
ON CONFLICT DO NOTHING;

-- Basic
INSERT INTO plan_modules (plano_slug, module_slug, included) VALUES
  ('basic', 'imobiliario', TRUE), ('basic', 'marketing', TRUE),
  ('basic', 'financeiro',  FALSE),('basic', 'juridico',  FALSE),
  ('basic', 'elearning',   TRUE)
ON CONFLICT (plano_slug, module_slug) DO UPDATE SET included = EXCLUDED.included;

-- Standard
INSERT INTO plan_modules (plano_slug, module_slug, included) VALUES
  ('standard', 'imobiliario', TRUE), ('standard', 'marketing', TRUE),
  ('standard', 'juridico',    TRUE), ('standard', 'financeiro',FALSE),
  ('standard', 'elearning',   TRUE)
ON CONFLICT (plano_slug, module_slug) DO UPDATE SET included = EXCLUDED.included;

-- Pro
INSERT INTO plan_modules (plano_slug, module_slug, included) VALUES
  ('pro', 'imobiliario', TRUE), ('pro', 'financeiro', TRUE),
  ('pro', 'marketing',   TRUE), ('pro', 'juridico',   TRUE),
  ('pro', 'elearning',   TRUE)
ON CONFLICT (plano_slug, module_slug) DO UPDATE SET included = EXCLUDED.included;

-- Business: todos os módulos
INSERT INTO plan_modules (plano_slug, module_slug, included)
SELECT 'business', slug, TRUE FROM public.modules WHERE parent_slug IS NULL
ON CONFLICT (plano_slug, module_slug) DO UPDATE SET included = TRUE;

-- mkt-aut: DESABILITADO em todos os planos até QA aprovar
UPDATE plan_features SET included = FALSE WHERE feature_slug = 'mkt-aut';
INSERT INTO plan_features (plano_slug, feature_slug, included)
SELECT slug, 'mkt-aut', FALSE FROM public.plans
ON CONFLICT (plano_slug, feature_slug) DO UPDATE SET included = FALSE;

-- ── Verificação ───────────────────────────────────────────────────────────
DO $$
DECLARE v_mods INTEGER; v_feats INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mods  FROM public.modules WHERE parent_slug IS NULL;
  SELECT COUNT(*) INTO v_feats FROM public.modules WHERE parent_slug IS NOT NULL;
  RAISE NOTICE 'modules: % macro-módulos, % features', v_mods, v_feats;
  SELECT COUNT(*) INTO v_mods FROM plan_modules WHERE included = TRUE;
  SELECT COUNT(*) INTO v_feats FROM plan_features WHERE included = TRUE;
  RAISE NOTICE 'plan_modules habilitados: %, plan_features habilitadas: %', v_mods, v_feats;
END $$;
