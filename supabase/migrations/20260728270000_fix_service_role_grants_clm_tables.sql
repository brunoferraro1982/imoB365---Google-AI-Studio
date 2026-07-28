-- Achado real de produção (2026-07-28), mesma categoria já documentada pro
-- incidente de captacao_configs (2026-07-25): tabelas novas aplicadas em
-- produção via `psql -U supabase_admin` direto por SSH (não via Studio/CLI,
-- que roda como role `postgres`) nunca herdam o GRANT automático que este
-- self-host dá por padrão em toda tabela public — e dessa vez o gap real
-- era em `service_role`, não só `anon`/`authenticated`: o cron de captação
-- automática rodava com 200 OK mas sempre processava 0 configs, porque
-- `supabaseAdmin` (service_role) batia "permission denied for table
-- captacao_configs" e o código não checava `error` no destructuring
-- (`const { data } = await client...`), então o erro era engolido
-- silenciosamente — nenhum log, nenhuma exceção, só configsProcessadas:0
-- pra sempre. O mesmo gap afeta 4 tabelas novas do programa CLM (Sprint 3,
-- 6, 8, 9), quebrando silenciosamente o webhook de assinatura eletrônica
-- (que também usa supabaseAdmin) desde o deploy.
--
-- RLS continua sendo a barreira real em todas essas tabelas — GRANT só
-- libera a tentativa de operação a nível de tabela, nunca acesso direto
-- a uma linha específica (confirmado: nenhuma dessas tabelas tem policy
-- que dê acesso a `anon`).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_etapas TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_dados_pagamento TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_documentos TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_assinatura_config TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_base TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_listings TO service_role;

-- EXECUTE na função pública nova do Portal do Proprietário também passa por
-- esse mesmo gap (função criada via psql direto) — sem isso, chamar a RPC
-- via client autenticado (authenticated) já funcionava (GRANT já estava na
-- própria migration), mas formaliza aqui por consistência de auditoria.
GRANT EXECUTE ON FUNCTION public.public_meus_contratos() TO authenticated;
