-- Fase 3 (parte 2) do módulo Financeiro — cobrança real via Mercado Pago
-- Marketplace. A parte 1 (20260727160000) só conectava a conta do tenant via
-- OAuth; esta parte gera de fato o link de pagamento (Checkout Pro, PIX/
-- boleto/cartão) usando o access_token do tenant conectado, cobrando o
-- cliente final (comprador de venda ou locatário de locação) e descontando a
-- comissão da plataforma via `marketplace_fee`.
--
-- Cada cobrança referencia OU uma contrato_parcelas (venda) OU um
-- lancamentos_financeiros (locação/avulso) — por isso origem_tipo/origem_id
-- em vez de duas FKs nullable, evitando duas colunas quase sempre vazias.
CREATE TABLE public.cobrancas_mercadopago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('parcela', 'lancamento')),
  origem_id uuid NOT NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  valor numeric NOT NULL,
  marketplace_fee numeric NOT NULL DEFAULT 0,
  mp_preference_id text,
  mp_payment_id text,
  link_pagamento text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'falhou', 'cancelado')),
  criado_por uuid, -- null = gerada automaticamente pelo cron, não por um usuário
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Evita duas cobranças pendentes simultâneas pra mesma parcela/lançamento
-- (dupla criação por clique duplo ou corrida entre o botão manual e o cron).
CREATE UNIQUE INDEX idx_cobrancas_mp_origem_pendente
  ON public.cobrancas_mercadopago(origem_tipo, origem_id) WHERE status = 'pendente';
CREATE INDEX idx_cobrancas_mp_tenant ON public.cobrancas_mercadopago(tenant_id);

ALTER TABLE public.cobrancas_mercadopago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_mp_members_read" ON public.cobrancas_mercadopago
  FOR SELECT
  TO authenticated
  USING (
    is_member_of_tenant(auth.uid(), tenant_id)
    AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin')
      OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
    )
  );
CREATE POLICY "cobrancas_mp_super_admin_all" ON public.cobrancas_mercadopago FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
-- Sem policy de INSERT/UPDATE/DELETE pra admin/financeiro: toda escrita passa
-- por server function (supabaseAdmin) ou pelo webhook, nunca direto do
-- client — mesmo padrão de tenant_mercadopago_accounts, já que a criação
-- exige chamar a API do Mercado Pago antes de gravar o resultado.

CREATE TRIGGER trg_cobrancas_mp_updated
  BEFORE UPDATE ON public.cobrancas_mercadopago
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Idempotência do webhook de marketplace (mesmo padrão de `payment_events`,
-- que é exclusivo da assinatura SaaS da própria plataforma — este cobre os
-- pagamentos que os TENANTS recebem dos próprios clientes finais).
CREATE TABLE public.cobrancas_mercadopago_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_notification_id text NOT NULL UNIQUE,
  cobranca_id uuid REFERENCES public.cobrancas_mercadopago(id) ON DELETE SET NULL,
  tenant_id uuid,
  event_type text,
  raw_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas_mercadopago_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobrancas_mp_eventos_super_admin_read" ON public.cobrancas_mercadopago_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
-- Sem policy de escrita nenhuma (nem pra super_admin) — só o webhook grava,
-- via supabaseAdmin, mesmo padrão de payment_events.

-- Config de cobrança automática por tenant — o disparo (manual vs
-- automático) é escolha do próprio tenant, não fixa no código.
ALTER TABLE public.tenant_mercadopago_accounts
  ADD COLUMN IF NOT EXISTS cobranca_automatica_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_automatica_dias_antes integer NOT NULL DEFAULT 3;

-- Roda uma vez por dia, gerando cobranças automáticas pros tenants que
-- ligaram a opção (ver src/routes/api.public.cron.gerar-cobrancas-mercadopago.ts).
-- IMPORTANTE: <ANON_OR_PUBLISHABLE_KEY> e a URL devem ser substituídos pelo
-- valor real de CADA ambiente ao aplicar esta migration (dev vs. produção
-- têm URL e chave diferentes) — mesmo padrão já usado nos crons anteriores.
SELECT cron.schedule(
  'gerar-cobrancas-mercadopago-diario',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/gerar-cobrancas-mercadopago',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
