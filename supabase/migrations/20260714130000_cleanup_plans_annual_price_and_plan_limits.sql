-- plans tinha duas colunas de preço anual idênticas: `preco_anual` e `price_annual`
-- (mesmos valores em todas as linhas). Nenhuma delas nunca foi gerada em types.ts, e
-- `price_annual` não é lida em nenhum lugar do código-fonte — mantém só `preco_anual`,
-- que já segue a mesma convenção em português de `preco_mensal`.
ALTER TABLE public.plans DROP COLUMN IF EXISTS price_annual;

-- plan_limits era uma tabela paralela para os mesmos limites já guardados em
-- plans.limites (jsonb), mas nunca foi lida em nenhum outro lugar do app — só
-- admin.limites.tsx escrevia nela, e nada consumia. Confirmado 0 linhas na tabela
-- antes de remover: nenhuma perda de dado real.
DROP TABLE IF EXISTS public.plan_limits;
