-- Re-seed idempotente de plans (tabela vazia em prod quebrava tenants_plano_slug_fkey).
-- Valores alinhados à migração 20260521144755 + plano 'free'.
insert into public.plans (slug, nome, preco_mensal, modulos_incluidos, limites, ativo)
values
  ('free',     'Free',       0,  '{core,catalogo,crm}'::text[],                  '{"imoveis": 25,   "usuarios": 3,   "modulos": 2}'::jsonb,  true),
  ('basic',    'Basic',     99,  '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 50,   "usuarios": 3,   "modulos": 3}'::jsonb,  true),
  ('standard', 'Standard', 199,  '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 250,  "usuarios": 8,   "modulos": 5}'::jsonb,  true),
  ('pro',      'Pro',      349,  '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 1000, "usuarios": 20,  "modulos": 8}'::jsonb,  true),
  ('business', 'Business', 599,  '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 10000,"usuarios": 100, "modulos": -1}'::jsonb, true)
on conflict (slug) do update set
  nome              = excluded.nome,
  preco_mensal      = excluded.preco_mensal,
  modulos_incluidos = excluded.modulos_incluidos,
  limites           = excluded.limites,
  ativo             = true;

-- Backfill: tenants com plano_slug inválido apontam para 'free'.
update public.tenants set plano_slug = 'free'
 where plano_slug is not null
   and plano_slug not in (select slug from public.plans);
