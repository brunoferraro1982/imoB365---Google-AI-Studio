-- Fase 1 do incremento do módulo Financeiro (inadimplência automatizada):
-- lancamentos_financeiros.status já suportava 'atrasado' no enum desde
-- 20260521144213, mas nada no sistema fazia essa transição automaticamente
-- — só existia como opção manual em LancamentoForm.tsx. As duas colunas
-- abaixo evitam reenviar o mesmo lembrete por e-mail toda vez que o cron
-- diário roda (mesmo padrão de marcador usado em visitas.lembrete_enviado_at).
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS lembrete_vencimento_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS lembretes_atraso_enviados smallint NOT NULL DEFAULT 0;

-- Índice composto pro scan diário do cron (idx_lancamentos_venc já existia,
-- mas sem o status na composição).
CREATE INDEX IF NOT EXISTS idx_lancamentos_status_venc
  ON public.lancamentos_financeiros(status, data_vencimento);

-- Roda todo dia às 09:00 UTC (06:00 BRT) — ver
-- src/lib/inadimplencia.ts e src/routes/api.public.cron.inadimplencia.ts.
SELECT cron.schedule(
  'processar-inadimplencia-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/inadimplencia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
