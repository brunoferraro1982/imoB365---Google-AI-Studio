-- Conexão OAuth por tenant com a Meta (Facebook/Instagram) — permite
-- publicar o catálogo de imóveis do tenant (Dynamic Ads/Marketplace) e,
-- numa fase seguinte, receber de volta os leads gerados via Lead Ads.
-- Espelha exatamente o padrão já usado em tenant_mercadopago_accounts
-- (migration 20260727160000): um único Meta App registrado UMA VEZ pelo
-- imoB365 (META_APP_ID/META_APP_SECRET, env vars) contra o qual cada tenant
-- se autoriza individualmente — nunca uma conta Meta operada pelo imoB365
-- compartilhada entre tenants.
CREATE TABLE public.tenant_meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_user_id text NOT NULL,
  page_id text NOT NULL,
  page_name text,
  page_access_token text NOT NULL,
  business_id text,
  catalog_id text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Mesmo padrão "seguro por padrão" de tenant_mercadopago_accounts: RLS
-- habilitado SEM nenhuma policy (deny-all) — nenhum client-side role
-- (anon/authenticated) consegue ler ou escrever aqui, mesmo o próprio dono
-- do tenant. Todo acesso passa por server functions usando supabaseAdmin
-- (service role), que decide explicitamente o que expor ao client (nunca o
-- token).
ALTER TABLE public.tenant_meta_connections ENABLE ROW LEVEL SECURITY;
