-- Conexão OAuth por tenant com o DocuSign — primeira integração REAL de
-- assinatura eletrônica do CLM (as outras 4 opções de
-- tenant_assinatura_config — Clicksign/ZapSign/gov.br/ICP-Brasil — ficam no
-- padrão simplificado de API key, confirmado que nenhuma delas oferece um
-- fluxo OAuth de redirecionamento real). Mesmo padrão BYO-OAuth já usado em
-- tenant_meta_connections/tenant_canva_connections/
-- tenant_mercadopago_accounts: cada tenant cria a própria Integration Key
-- no DocuSign e conecta a própria conta — nunca uma conta DocuSign operada
-- pela imoB365 compartilhada entre tenants.
CREATE TABLE public.tenant_docusign_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  account_id text,
  account_name text,
  base_uri text,
  connect_secret text,
  connect_configuration_id text,
  connected_at timestamptz,
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenant_docusign_connections_set_updated_at
  BEFORE UPDATE ON public.tenant_docusign_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Mesmo padrão "seguro por padrão" das demais conexões BYO: RLS habilitado
-- SEM nenhuma policy (deny-all) — todo acesso passa por server functions
-- usando supabaseAdmin (service role).
ALTER TABLE public.tenant_docusign_connections ENABLE ROW LEVEL SECURITY;

-- GRANT explícito pros 3 roles já na própria migration — lição repetida
-- várias vezes neste projeto: tabelas aplicadas em produção via SSH+psql
-- direto nunca herdam o GRANT automático que o Studio dá por padrão.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.tenant_docusign_connections TO anon, authenticated, service_role;
