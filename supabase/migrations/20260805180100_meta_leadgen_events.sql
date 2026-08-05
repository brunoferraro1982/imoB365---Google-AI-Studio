-- Tabela de idempotência do webhook de Lead Ads da Meta (Fase 3) — mesmo
-- padrão de payment_events (Mercado Pago): uma tabela de idempotência
-- dedicada por integração de webhook, nunca uma genérica compartilhada.
-- Insere ANTES de processar; violação de UNIQUE(leadgen_id) = notificação
-- reenviada, responde 200 sem reprocessar.
CREATE TABLE public.meta_leadgen_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leadgen_id text NOT NULL UNIQUE,
  page_id text NOT NULL,
  tenant_id uuid,
  lead_id uuid,
  raw_payload jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_leadgen_events ENABLE ROW LEVEL SECURITY;
-- Sem policies (deny-all) — só o webhook (supabaseAdmin, service role)
-- escreve aqui, mesmo padrão de captacao_listings/payment_events.

-- GRANT explícito pros 3 roles: lição já aprendida várias vezes neste
-- projeto — tabelas criadas em produção via `psql -U supabase_admin` direto
-- por SSH (em vez de Studio/CLI) nunca herdam o GRANT automático de
-- ALTER DEFAULT PRIVILEGES do self-host. Incluir aqui já na origem evita
-- repetir o incidente de captacao_configs/contrato_etapas etc.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.meta_leadgen_events TO anon, authenticated, service_role;
