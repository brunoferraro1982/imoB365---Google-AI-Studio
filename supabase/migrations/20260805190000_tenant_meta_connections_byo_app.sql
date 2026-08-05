-- Meta App por tenant, não mais um app único compartilhado pelo imoB365.
--
-- Motivo (achado durante revisão do usuário, confirmado por pesquisa): a
-- permissão leads_retrieval (junto de pages_manage_metadata/catalog_management)
-- só funciona em "Standard Access" pra Páginas que o próprio app/Business
-- Manager já possui. Um app único do imoB365 tentando gerenciar Páginas de
-- centenas de tenants diferentes exigiria App Review + Business Verification
-- da Meta (processo de semanas, sem garantia de aprovação) — na prática,
-- provavelmente nem funcionaria pra um tenant real conectar a própria
-- Página. A solução: cada tenant cria o próprio Meta App (dentro do próprio
-- Business Manager, gerenciando só a própria Página — Standard Access,
-- sem revisão) e cola App ID/App Secret numa tela de configuração própria
-- (ver app.portais.meta.tsx). Mesmo princípio BYO já usado em
-- atendimentoEmail.functions.ts/atendimentoWhatsApp.functions.ts.
ALTER TABLE public.tenant_meta_connections
  ADD COLUMN app_id text,
  ADD COLUMN app_secret text;

-- Antes essas colunas só existiam depois do OAuth completar (linha inteira
-- inserida de uma vez no callback). Agora a linha nasce só com
-- app_id/app_secret (Passo 1 do wizard, antes de qualquer OAuth) e só ganha
-- os campos abaixo depois de conectar a Página (Passo 2) — precisam aceitar
-- NULL nesse meio-tempo.
ALTER TABLE public.tenant_meta_connections
  ALTER COLUMN meta_user_id DROP NOT NULL,
  ALTER COLUMN page_id DROP NOT NULL,
  ALTER COLUMN page_access_token DROP NOT NULL;
