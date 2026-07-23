-- Cidades e região de atuação (corretor/imobiliária) — decisão deliberada de
-- usar texto livre em vez de tabelas de municípios/regiões do IBGE: "cidade"
-- já é tratado como texto livre em toda a base (busca de imóveis, calculadora
-- de avaliação via CEP/ViaCEP), e "região" no sentido de mercado imobiliário
-- (ex. "Litoral Sul de SP") é um rótulo coloquial sem lista nacional canônica.
-- RLS pública (tenants_public_read) e de escrita (tenants_admin_update) já
-- cobrem essas colunas novas — nenhuma policy nova é necessária.

alter table public.tenants
  add column if not exists cidades_atuacao text[],
  add column if not exists regiao_atuacao text;

alter table public.tenants
  add constraint tenants_cidades_atuacao_max3
  check (coalesce(array_length(cidades_atuacao, 1), 0) <= 3);

alter table public.tenants
  add constraint tenants_regiao_atuacao_len
  check (regiao_atuacao is null or length(regiao_atuacao) <= 120);

comment on column public.tenants.cidades_atuacao is
  'Até 3 cidades onde o corretor/imobiliária atua. Texto livre, sem FK pra tabela de municípios (decisão deliberada).';
comment on column public.tenants.regiao_atuacao is
  'Nome informal da região de atuação (ex.: "Litoral Sul de SP"). Texto livre, não padronizado.';
