-- Novo valor de origem pra leads gerados pelo robô de captação automática
-- (varre a Chaves na Mão em busca de anúncios que casam com a busca
-- configurada pelo corretor/imobiliária). Isolado em migration própria:
-- Postgres não permite ALTER TYPE ... ADD VALUE na mesma transação que
-- usa o valor novo (mesmo padrão já usado pra 'api' em 20260521162635).
ALTER TYPE public.lead_origem ADD VALUE IF NOT EXISTS 'captacao_automatica';
