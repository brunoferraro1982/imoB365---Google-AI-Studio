-- Adiciona o 5º layout do assistente ("amplo" — áreas configuráveis:
-- Navbar/Content/Meta, ver PR de layout com áreas). O nome padrão de
-- constraint gerado pelo Postgres para o `check` inline criado em
-- 20260715180000_add_tenant_site_settings_secoes_layout.sql é
-- "<tabela>_<coluna>_check" — confirmar com `\d tenant_site_settings`
-- antes de aplicar, e ajustar o nome abaixo se divergir.
alter table public.tenant_site_settings
  drop constraint if exists tenant_site_settings_layout_check;
alter table public.tenant_site_settings
  add constraint tenant_site_settings_layout_check
  check (layout in ('classico', 'editorial', 'vitrine', 'boutique', 'amplo'));
