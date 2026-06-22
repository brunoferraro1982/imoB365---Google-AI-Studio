-- ============================================================
-- imoB365 — Migration: Módulos, Features e Plano×Módulo
-- Sprint 1 | 2026-06-22
-- Adapta-se à estrutura real: plans usa coluna 'slug' (não 'code')
-- Seed de plans já existe em 20260616115023_seed_plans.sql — não duplicar
-- ============================================================

-- ── Tabela de módulos e features ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_code TEXT REFERENCES modules(code) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Macro-módulos
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-imob',   '1. Imobiliário — Gestão de Propriedades & Leads', NULL, 1),
  ('mod-fin',    '2. Financeiro — Comissões & Faturamento',          NULL, 2),
  ('mod-mkt',    '3. Marketing — Campanhas & Distribuição',          NULL, 3),
  ('mod-juri',   '4. Jurídico — Contratos & Compliance',             NULL, 4),
  ('mod-elearn', '5. E-Learning — Capacitação de Corretores',        NULL, 5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Features: Imobiliário
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-imob-cad',      'a. Cadastro e edição de imóveis',            'mod-imob', 1),
  ('mod-imob-cadim',    'b. Galeria de fotos (FotosManager)',          'mod-imob', 2),
  ('mod-imob-leads',    'c. Pipeline de leads (Kanban drag-and-drop)', 'mod-imob', 3),
  ('mod-imob-leadshis', 'd. Detalhes do lead com histórico',           'mod-imob', 4),
  ('mod-imob-chat',     'e. Chat em tempo real com leads',             'mod-imob', 5),
  ('mod-imob-agenda',   'f. Agendamento de visitas',                   'mod-imob', 6),
  ('mod-imob-nps',      'g. Avaliação pós-visita',                     'mod-imob', 7),
  ('mod-imob-comp',     'h. Comparação entre imóveis',                 'mod-imob', 8)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code;

-- Features: Financeiro
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-fin-calc',  'a. Cálculo automático de comissões', 'mod-fin', 1),
  ('mod-fin-cc',    'b. Centro de custo',                 'mod-fin', 2),
  ('mod-fin-cont',  'c. Plano de contas (contábil)',       'mod-fin', 3),
  ('mod-fin-nf',    'd. Emissão de recibos/NFe',           'mod-fin', 4),
  ('mod-fin-dash',  'e. Dashboard de faturamento',         'mod-fin', 5),
  ('mod-fin-relat', 'f. Relatórios financeiros',           'mod-fin', 6)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code;

-- Features: Marketing
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-mkt-portal', 'a. Portal de anúncios (white-label por tenant)', 'mod-mkt', 1),
  ('mod-mkt-blog',   'b. Blog integrado (posts e páginas)',             'mod-mkt', 2),
  ('mod-mkt-mult',   'c. Feed multi-portal (VivaReal, ZAP, OLX/XML)',   'mod-mkt', 3),
  ('mod-mkt-wid',    'd. Widgets de customização',                       'mod-mkt', 4),
  ('mod-mkt-brand',  'e. Branding (logo, cores, domínios)',              'mod-mkt', 5),
  ('mod-mkt-url',    'f. Encurtador de URLs',                            'mod-mkt', 6),
  ('mod-mkt-aut',    'g. Cadências de automação (em desenvolvimento)',    'mod-mkt', 7)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code;

-- Features: Jurídico
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-juri-exam',   'a. Biblioteca de modelos de contrato',   'mod-juri', 1),
  ('mod-juri-cont',   'b. Gerador de contratos',                'mod-juri', 2),
  ('mod-juri-assina', 'c. Assinatura digital (ClickSign/D4Sign)','mod-juri', 3),
  ('mod-juri-cart',   'e. Gestão de cartórios',                 'mod-juri', 4),
  ('mod-juri-check',  'f. Checklist de documentação',           'mod-juri', 5),
  ('mod-juri-vers',   'g. Versionamento de contratos',          'mod-juri', 6)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code;

-- Features: E-Learning
INSERT INTO modules (code, name, parent_code, sort_order) VALUES
  ('mod-elearn-cursos', 'a. Plataforma de cursos',  'mod-elearn', 1),
  ('mod-elearn-modelo', 'b. Modelos de cursos',      'mod-elearn', 2),
  ('mod-elearn-adm',    'c. Admin de e-learning',    'mod-elearn', 3),
  ('mod-elearn-cert',   'd. Certificações e badges', 'mod-elearn', 4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code;

-- ── Tabelas de relacionamento Plano × Módulo ──────────────────────────────
-- Usa plano_slug (TEXT) referenciando plans(slug) — estrutura real do banco
CREATE TABLE IF NOT EXISTS plan_modules (
  plano_slug   TEXT NOT NULL REFERENCES public.plans(slug) ON DELETE CASCADE,
  module_code  TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
  included     BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plano_slug, module_code)
);

CREATE TABLE IF NOT EXISTS plan_features (
  plano_slug    TEXT NOT NULL REFERENCES public.plans(slug) ON DELETE CASCADE,
  feature_code  TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
  included      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plano_slug, feature_code)
);

-- ── Trigger: liberar módulo → liberar automaticamente todas as features ───
CREATE OR REPLACE FUNCTION fn_auto_plan_features()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.included = TRUE THEN
    INSERT INTO plan_features (plano_slug, feature_code, included)
    SELECT NEW.plano_slug, m.code, TRUE
    FROM modules m
    WHERE m.parent_code = NEW.module_code
    ON CONFLICT (plano_slug, feature_code) DO UPDATE SET included = TRUE;
  ELSE
    UPDATE plan_features SET included = FALSE
    WHERE plano_slug = NEW.plano_slug
      AND feature_code IN (
        SELECT code FROM modules WHERE parent_code = NEW.module_code
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_plan_features ON plan_modules;
CREATE TRIGGER trg_auto_plan_features
  AFTER INSERT OR UPDATE ON plan_modules
  FOR EACH ROW EXECUTE FUNCTION fn_auto_plan_features();

-- ── Seed: Free ────────────────────────────────────────────────────────────
INSERT INTO plan_modules (plano_slug, module_code, included) VALUES
  ('free', 'mod-imob',   TRUE),
  ('free', 'mod-mkt',    FALSE),
  ('free', 'mod-fin',    FALSE),
  ('free', 'mod-juri',   FALSE),
  ('free', 'mod-elearn', TRUE)
ON CONFLICT (plano_slug, module_code) DO UPDATE SET included = EXCLUDED.included;

-- Free: restringir features específicas após trigger
UPDATE plan_features SET included = FALSE
WHERE plano_slug = 'free'
  AND feature_code IN ('mod-imob-chat','mod-imob-agenda','mod-imob-nps','mod-imob-comp',
                        'mod-elearn-adm','mod-elearn-modelo');

-- Free: branding básico incluso
INSERT INTO plan_features (plano_slug, feature_code, included) VALUES ('free','mod-mkt-brand',TRUE)
ON CONFLICT DO NOTHING;

-- ── Seed: Basic ───────────────────────────────────────────────────────────
INSERT INTO plan_modules (plano_slug, module_code, included) VALUES
  ('basic', 'mod-imob',   TRUE),
  ('basic', 'mod-mkt',    TRUE),
  ('basic', 'mod-fin',    FALSE),
  ('basic', 'mod-juri',   FALSE),
  ('basic', 'mod-elearn', TRUE)
ON CONFLICT (plano_slug, module_code) DO UPDATE SET included = EXCLUDED.included;

-- ── Seed: Standard ────────────────────────────────────────────────────────
INSERT INTO plan_modules (plano_slug, module_code, included) VALUES
  ('standard', 'mod-imob',   TRUE),
  ('standard', 'mod-mkt',    TRUE),
  ('standard', 'mod-juri',   TRUE),
  ('standard', 'mod-fin',    FALSE),
  ('standard', 'mod-elearn', TRUE)
ON CONFLICT (plano_slug, module_code) DO UPDATE SET included = EXCLUDED.included;

-- ── Seed: Pro ─────────────────────────────────────────────────────────────
INSERT INTO plan_modules (plano_slug, module_code, included) VALUES
  ('pro', 'mod-imob',   TRUE),
  ('pro', 'mod-fin',    TRUE),
  ('pro', 'mod-mkt',    TRUE),
  ('pro', 'mod-juri',   TRUE),
  ('pro', 'mod-elearn', TRUE)
ON CONFLICT (plano_slug, module_code) DO UPDATE SET included = EXCLUDED.included;

-- ── Seed: Business ────────────────────────────────────────────────────────
INSERT INTO plan_modules (plano_slug, module_code, included)
SELECT 'business', code, TRUE FROM modules WHERE parent_code IS NULL
ON CONFLICT (plano_slug, module_code) DO UPDATE SET included = TRUE;

-- mod-mkt-aut: DESABILITADO em produção até QA aprovar
UPDATE plan_features SET included = FALSE WHERE feature_code = 'mod-mkt-aut';

COMMENT ON TABLE plan_modules IS 'Módulos por plano — trigger fn_auto_plan_features propaga para plan_features';
COMMENT ON TABLE plan_features IS 'Features por plano — auto-populada pelo trigger ao liberar módulo';

-- ── Verificar slugs de planos existentes ─────────────────────────────────
DO $$
DECLARE
  v_slugs TEXT[];
BEGIN
  SELECT array_agg(slug) INTO v_slugs FROM public.plans;
  RAISE NOTICE 'Slugs de planos existentes: %', v_slugs;
END $$;
