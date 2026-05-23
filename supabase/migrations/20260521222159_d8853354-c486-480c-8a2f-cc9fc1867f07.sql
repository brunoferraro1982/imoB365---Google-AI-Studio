-- Daily job: scan saved searches with email alerts and dispatch digest emails
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule if exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('buscas-alertas-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'buscas-alertas-diario',
  '0 11 * * *', -- 11:00 UTC = 08:00 America/Sao_Paulo
  $$
  SELECT net.http_post(
    url := 'https://project--e7dbc678-9151-4590-925f-3c3929336975.lovable.app/api/public/cron/buscas-alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $$
);