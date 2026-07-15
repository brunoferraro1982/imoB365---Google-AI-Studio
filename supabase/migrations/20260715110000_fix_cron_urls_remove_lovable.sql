-- As URLs de cron abaixo apontavam para uma URL de preview específica
-- (project--e7dbc678-9151-4590-925f-3c3929336975.lovable.app) que não
-- corresponde a nenhum deploy ativo/real do projeto. O domínio definitivo de
-- produção é portal.imob365.com.br (ainda não publicado no momento desta
-- migration, mas é para onde o projeto vai apontar assim que for implantado)
-- — nenhuma URL de preview deve ficar hardcoded em configuração persistida.
--
-- cron.schedule() com o mesmo nome de job substitui o agendamento existente,
-- então basta rechamar para os 3 jobs que apontavam pra URL de preview.

SELECT cron.schedule(
  'buscas-alertas-diario',
  '0 11 * * *', -- 11:00 UTC = 08:00 America/Sao_Paulo
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/buscas-alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'processar-notificacoes-visitas',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/visitas-notificacoes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'expire-trials-diario',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/expire-trials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
