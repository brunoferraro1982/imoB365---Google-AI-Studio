-- Fix real de produção: "permission denied for table tenant_meta_connections"
-- ao testar a conexão Meta em prod (usuário bruno.ferraro09@hotmail.com,
-- 2026-09-04). Causa raiz: a migration original desta tabela
-- (20260805171000_tenant_meta_connections.sql), aplicada em produção via
-- SSH+psql, nunca teve GRANT explícito pra nenhum role — diferente da
-- migration seguinte no mesmo dia (20260805180100_meta_leadgen_events.sql),
-- que já incluía o GRANT (lição aprendida no meio do próprio dia, mas nunca
-- retroaplicada nesta tabela). Todo acesso é via supabaseAdmin
-- (service_role) nos server functions de metaOAuth.functions.ts/
-- metaPublish.functions.ts/api.public.meta.oauth.callback.ts/
-- api.public.webhooks.meta.ts — sem este GRANT, nem o service_role conseguia
-- ler/escrever, mesmo com RLS "deny-all" intencional preservado (bypassar
-- RLS não dispensa o GRANT de tabela em si).
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.tenant_meta_connections TO anon, authenticated, service_role;
