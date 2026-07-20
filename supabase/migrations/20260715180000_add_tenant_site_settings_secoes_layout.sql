-- Ordem/visibilidade das seções principais da home pública do tenant
-- (Hero é sempre fixo/primeiro, não entra nesta lista). Formato:
-- [{"key": "imoveis", "visivel": true, "ordem": 0}, {"key": "sobre", ...}, ...]
-- Mantido separado de tenant_site_widgets (que continua controlando apenas
-- as sidebars esquerda/direita — um concern completamente distinto).
alter table public.tenant_site_settings
  add column if not exists secoes jsonb not null default '[
    {"key": "imoveis", "visivel": true, "ordem": 0},
    {"key": "sobre", "visivel": true, "ordem": 1},
    {"key": "blog_destaque", "visivel": false, "ordem": 2},
    {"key": "contato", "visivel": true, "ordem": 3}
  ]'::jsonb;

-- Layout visual/estrutural escolhido no assistente (4 opções pré-formatadas,
-- ver PR de layouts). "classico" é o design atual — default para que
-- tenants existentes não tenham nenhuma mudança visual até optarem por
-- outro layout.
alter table public.tenant_site_settings
  add column if not exists layout text not null default 'classico'
    check (layout in ('classico', 'editorial', 'vitrine', 'boutique'));
