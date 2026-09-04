-- Fix real de produção: OAuth completava do lado da Meta (200, token
-- válido), mas /me/accounts sempre retornava {data: []} mesmo com a
-- Página corretamente atribuída ao Portfólio Empresarial com acesso
-- total (confirmado via log de produção, 2026-09-04). Causa: apps tipo
-- "Negócios" com o produto "Login do Facebook para Empresas" só
-- concedem acesso a ativos (Páginas) de um Portfólio Empresarial através
-- de uma "Configuração de Login" (config_id) — o fluxo clássico por
-- `scope=...` não enumera esses ativos, mesmo com tudo "certo" do lado
-- da Meta. Ver getMetaAuthorizeUrl em src/lib/metaOAuth.functions.ts.
ALTER TABLE public.tenant_meta_connections
  ADD COLUMN IF NOT EXISTS login_config_id text;
