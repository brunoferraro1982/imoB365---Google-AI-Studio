-- Sprint fix — Alinha tabela plans ao spec §13.1 (preços anuais e limites corretos)

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_annual NUMERIC DEFAULT 0;

-- Valores corretos do spec §13.1
UPDATE public.plans
SET preco_mensal = 0, price_annual = 0,
    limites = jsonb_build_object('imoveis', 5, 'usuarios', 1)
WHERE slug = 'free';

UPDATE public.plans
SET preco_mensal = 99.90, price_annual = 1054.80,
    limites = jsonb_build_object('imoveis', 20, 'usuarios', 2)
WHERE slug = 'basic';

UPDATE public.plans
SET preco_mensal = 199.90, price_annual = 2110.80,
    limites = jsonb_build_object('imoveis', 60, 'usuarios', 5)
WHERE slug = 'standard';

UPDATE public.plans
SET preco_mensal = 399.90, price_annual = 4222.80,
    limites = jsonb_build_object('imoveis', 140, 'usuarios', 15)
WHERE slug = 'pro';

UPDATE public.plans
SET preco_mensal = 0, price_annual = 0,
    limites = jsonb_build_object('imoveis', -1, 'usuarios', -1)
WHERE slug = 'business';
