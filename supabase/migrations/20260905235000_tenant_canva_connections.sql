-- Conexão OAuth por tenant com a Canva — permite ao corretor/imobiliária
-- editar a imagem de um post/story de imóvel no editor de verdade da
-- Canva (via Return Navigation, ver Canva Connect API) usando a PRÓPRIA
-- conta pessoal/Pro. Mesmo modelo BYO já usado em tenant_meta_connections
-- e tenant_mercadopago_accounts: cada tenant cria a própria integração na
-- Canva (tipo "Privada", sem revisão da Canva necessária — só integrações
-- "Públicas" passam por isso) e cola Client ID/Secret aqui — nunca uma
-- conta Canva operada pela imob365 compartilhada entre tenants.
CREATE TABLE public.tenant_canva_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  canva_user_id text,
  connected_at timestamptz,
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenant_canva_connections_set_updated_at
  BEFORE UPDATE ON public.tenant_canva_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Mesmo padrão "seguro por padrão" de tenant_meta_connections: RLS
-- habilitado SEM nenhuma policy (deny-all) — nenhum client-side role
-- (anon/authenticated) consegue ler ou escrever aqui, mesmo o próprio dono
-- do tenant. Todo acesso passa por server functions usando supabaseAdmin
-- (service role), que decide explicitamente o que expor ao client (nunca
-- os tokens).
ALTER TABLE public.tenant_canva_connections ENABLE ROW LEVEL SECURITY;

-- GRANT explícito pros 3 roles já na própria migration — lição aprendida
-- (e reaprendida) várias vezes nesta sessão: tabelas aplicadas em produção
-- via SSH+psql direto nunca herdam o GRANT automático que o Studio dá por
-- padrão. Incluir aqui desde a origem evita repetir o mesmo incidente
-- (tenant_meta_connections, captacao_configs, contrato_etapas etc.).
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.tenant_canva_connections TO anon, authenticated, service_role;

-- Auditoria/rastreio de cada design criado na Canva a partir de um imóvel
-- — mesmo padrão de imovel_social_posts: uma linha por tentativa, nunca
-- apagada, serve pra reencontrar o design_id quando o corretor volta da
-- Canva (correlation_state) e pra saber se um design já foi exportado.
CREATE TABLE public.imovel_canva_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  design_id text NOT NULL,
  edit_url text,
  status text NOT NULL DEFAULT 'editando' CHECK (status IN ('editando', 'exportado', 'erro')),
  media_public_url text,
  erro_mensagem text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_imovel_canva_designs_tenant ON public.imovel_canva_designs(tenant_id);
CREATE INDEX idx_imovel_canva_designs_imovel ON public.imovel_canva_designs(imovel_id, created_at DESC);

CREATE TRIGGER imovel_canva_designs_set_updated_at
  BEFORE UPDATE ON public.imovel_canva_designs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.imovel_canva_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY imovel_canva_designs_members_read ON public.imovel_canva_designs
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY imovel_canva_designs_write ON public.imovel_canva_designs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );
CREATE POLICY imovel_canva_designs_super_admin_all ON public.imovel_canva_designs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.imovel_canva_designs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_canva_designs TO service_role;
