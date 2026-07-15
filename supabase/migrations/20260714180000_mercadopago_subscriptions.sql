-- Integração de pagamentos via Mercado Pago (assinaturas recorrentes + o caso
-- avulso do Pro anual, que foi criado como "Link de pagamento" e não como
-- assinatura no painel do Mercado Pago).

-- 1. plans: referência aos planos de assinatura já criados no Mercado Pago
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id_mensal text,
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id_anual  text,
  ADD COLUMN IF NOT EXISTS mp_anual_cobranca_avulsa       boolean NOT NULL DEFAULT false;

UPDATE public.plans SET mp_preapproval_plan_id_mensal = '323fcb0f398948439096c082220b499c' WHERE slug = 'basic';
UPDATE public.plans SET mp_preapproval_plan_id_anual   = 'a7558ed00a0b426d813af4c384ac50c9' WHERE slug = 'basic';
UPDATE public.plans SET mp_preapproval_plan_id_mensal = 'df7f8a20a2874a729fc76bcf49e2e128' WHERE slug = 'standard';
UPDATE public.plans SET mp_preapproval_plan_id_anual   = '0a762bf2d14540f7adcb59a256faa831' WHERE slug = 'standard';
UPDATE public.plans SET mp_preapproval_plan_id_mensal = '948b33f30a564d28985f14262320c35e' WHERE slug = 'pro';
-- Pro anual não tem preapproval_plan — é cobrança avulsa (Checkout Pro), sem renovação automática.
UPDATE public.plans SET mp_anual_cobranca_avulsa = true WHERE slug = 'pro';

-- 2. tenants: estado da assinatura/pagamento
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id     text,
  ADD COLUMN IF NOT EXISTS payment_status             text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_cycle                 text,
  ADD COLUMN IF NOT EXISTS trial_grace_ends_at         timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_payment_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_payment_status_check
        CHECK (payment_status IN ('none', 'pending', 'authorized', 'paused', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_plan_cycle_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_plan_cycle_check
        CHECK (plan_cycle IS NULL OR plan_cycle IN ('monthly', 'annual'));
  END IF;
END;
$$;

-- 3. payment_events: log idempotente de notificações recebidas do Mercado Pago
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_notification_id text NOT NULL UNIQUE,
  tenant_id          uuid REFERENCES public.tenants(id),
  event_type         text NOT NULL,
  raw_payload        jsonb NOT NULL,
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_events_super_admin_read" ON public.payment_events;
CREATE POLICY "payment_events_super_admin_read" ON public.payment_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 4. cron_expire_trials: passa a ter um período de graça de 3 dias com
-- notificação antes de rebaixar pra Free de verdade (antes rebaixava na hora).
-- Devolve uma linha por tenant afetado + a ação tomada, para o chamador (rota de
-- cron) decidir quem precisa receber o e-mail de "assine para continuar".
-- DROP é necessário porque a assinatura de retorno mudou (antes não devolvia
-- linhas) — CREATE OR REPLACE não permite trocar o tipo de retorno.
DROP FUNCTION IF EXISTS public.cron_expire_trials();

CREATE OR REPLACE FUNCTION public.cron_expire_trials()
RETURNS TABLE(tenant_id uuid, action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.tenants t
  SET trial_grace_ends_at = now() + interval '3 days'
  WHERE t.status = 'trial'
    AND t.trial_ends_at IS NOT NULL
    AND t.trial_ends_at < now()
    AND t.trial_grace_ends_at IS NULL
  RETURNING t.id, 'notify'::text;

  RETURN QUERY
  UPDATE public.tenants t
  SET plano_slug = 'free',
      status = 'active',
      trial_ends_at = NULL,
      trial_grace_ends_at = NULL
  WHERE t.status = 'trial'
    AND t.trial_grace_ends_at IS NOT NULL
    AND t.trial_grace_ends_at < now()
    AND t.payment_status != 'authorized'
  RETURNING t.id, 'downgraded'::text;
END;
$$;

-- 5. Agenda o cron de verdade — hoje a função existia mas nunca era chamada
-- sozinha. Segue o mesmo padrão dos outros cron.schedule já existentes
-- (net.http_post para uma rota /api/public/cron/*, autenticada por apikey).
SELECT cron.schedule(
  'expire-trials-diario',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--e7dbc678-9151-4590-925f-3c3929336975.lovable.app/api/public/cron/expire-trials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
