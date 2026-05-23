
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenant_usage_snapshots ADD COLUMN IF NOT EXISTS contratos_ativos integer NOT NULL DEFAULT 0;
