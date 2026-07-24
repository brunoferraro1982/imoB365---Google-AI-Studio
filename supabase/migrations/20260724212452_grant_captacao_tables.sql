-- Achado real de produção (2026-07-25): "permission denied for table
-- captacao_configs" ao carregar /app inteiro (não só /app/leads/captacao)
-- para um usuário autenticado comum. Causa raiz: a migration anterior
-- (20260724192104_create_captacao_tables.sql) foi aplicada em produção via
-- `psql -U supabase_admin`, e o ALTER DEFAULT PRIVILEGES desta instância só
-- cobre objetos criados pelo role `postgres` (confirmado via
-- pg_default_acl.defaclrole) — diferente de toda tabela anterior do schema,
-- que sempre foi criada por esse caminho. Tabelas criadas como
-- `supabase_admin` (como via SSH direto, fora do fluxo normal de
-- provisionamento) nunca herdam o grant automático pra anon/authenticated
-- que Supabase Cloud/self-hosted dá por padrão em toda tabela public.
--
-- Confirmado em dev (Studio SQL Editor, roda como `postgres`) que os grants
-- já estavam corretos lá — só produção precisou do GRANT manual (já
-- aplicado direto via SSH antes desta migration, que só formaliza/rastreia
-- isso no repo). IF NOT EXISTS não existe para GRANT, mas GRANT é
-- idempotente por natureza (repetir não causa erro nem duplica nada).
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.captacao_configs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.captacao_listings TO anon, authenticated;
