-- Ingestão de leads da landing page externa (mkt.imob365.com.br → Tenant 0).
--
-- O submit-lead.php da hospedagem compartilhada grava no MySQL próprio e,
-- em seguida, envia o lead assinado (HMAC) para /api/public/webhooks/landing-lead,
-- que grava aqui via service_role. Nenhuma policy nova: o insert não passa por RLS.

-- 1. Origem própria, pra separar no funil dos leads do site do tenant ('site')
ALTER TYPE public.lead_origem ADD VALUE IF NOT EXISTS 'landing_page';

-- 2. Idempotência: o PHP reenvia (cron de pendentes) com o mesmo external_ref
--    ("mkt:<id da linha no MySQL>") — o índice único impede lead duplicado.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS fbclid text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_external_ref_uidx
  ON public.leads (tenant_id, external_ref)
  WHERE external_ref IS NOT NULL;
