-- Site público do tenant (/site/$slug) — redesign Liquid Glass.
-- Campos novos configuráveis em /app/site:
--   hero_imagem_url  foto de capa do topo (bucket tenant-branding)
--   hero_formulario  mostra o formulário de lead no topo (padrão: sim)
--   diferenciais     [{icone, titulo, texto}] — bloco "Diferenciais"
--   como_funciona    [{titulo, texto}]        — bloco "Como funciona"
-- Todos opcionais: vazio = o site usa texto padrão neutro.
alter table public.tenant_site_settings
  add column if not exists hero_imagem_url text,
  add column if not exists hero_formulario boolean not null default true,
  add column if not exists diferenciais jsonb,
  add column if not exists como_funciona jsonb;
