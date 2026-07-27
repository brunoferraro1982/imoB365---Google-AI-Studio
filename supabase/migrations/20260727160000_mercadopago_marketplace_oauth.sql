-- Fase 3 do incremento do módulo Financeiro (cobrança real via Mercado
-- Pago Marketplace) — primeira parte: conexão OAuth por tenant. O
-- MERCADOPAGO_ACCESS_TOKEN já existente no projeto é da PLATAFORMA (cobra
-- a assinatura SaaS do tenant); esta tabela guarda o token de cada TENANT
-- (obtido via OAuth), usado depois pra cobrar PIX/boleto/cartão do cliente
-- final da imobiliária, com comissão da plataforma via application_fee.
--
-- access_token/refresh_token nunca devem ser lidos pelo client — por isso
-- RLS fica habilitado SEM nenhuma policy (deny-all, mesmo padrão já
-- documentado como seguro-por-padrão neste projeto pra `assinaturas`/
-- `impulsionamentos`). Todo acesso passa por server functions com
-- supabaseAdmin (service role), que decidem o que expor ao client (status,
-- nunca o token em si).
CREATE TABLE IF NOT EXISTS public.tenant_mercadopago_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  mp_user_id bigint NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  public_key text,
  scope text,
  live_mode boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_mp_accounts_tenant
  ON public.tenant_mercadopago_accounts(tenant_id);

ALTER TABLE public.tenant_mercadopago_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_tenant_mp_accounts_updated
  BEFORE UPDATE ON public.tenant_mercadopago_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Comissão da plataforma (application_fee) configurável por plano
-- (padrão) e por tenant (override opcional, prevalece quando preenchido) —
-- decisão do usuário. A UI de admin pra editar estes dois campos e a
-- criação de cobrança em si (que efetivamente usa esse percentual) ficam
-- pra uma próxima PR — aqui só o schema, já pronto pra ser consumido.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS mp_comissao_percentual numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS mp_comissao_percentual numeric;
