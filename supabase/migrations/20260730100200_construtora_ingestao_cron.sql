-- pg_cron: dispara a rota de ingestão diariamente — dado imobiliário
-- (fotos/preços de lançamentos) muda bem menos que leads, não precisa de
-- hora em hora como captacao-automatica-horaria.
--
-- IMPORTANTE: <ANON_OR_PUBLISHABLE_KEY> abaixo é placeholder de propósito
-- (não é segredo, é a chave pública/anon do projeto — mas colar o valor
-- real aqui dispara o Gitleaks do CI como "generic-api-key" de alta
-- entropia, mesmo sendo uma string pensada pra ser pública, mesmo motivo
-- já documentado em 20260724192104_create_captacao_tables.sql). Ao aplicar
-- esta migration em cada ambiente (dev via Studio, produção via psql),
-- substituir pelo valor real daquele ambiente antes de rodar — dev e
-- produção têm chaves diferentes.
SELECT cron.schedule(
  'construtora-ingestao-diaria',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/construtora-ingestao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
