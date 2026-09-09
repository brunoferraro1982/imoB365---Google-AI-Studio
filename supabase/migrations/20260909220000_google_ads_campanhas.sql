-- Google Ads — conta única da própria imoB365 (não BYO por tenant, ver
-- CLAUDE.md changelog 2026-09-09 "Google Ads..."). Achado de arquitetura:
-- o Developer Token do Google Ads é emitido uma vez POR EMPRESA, não por
-- tenant — diferente de Meta/Canva/DocuSign, não existe um caminho de
-- "cada corretor cria a própria integração instantânea". Decisão de
-- negócio do usuário: o super_admin conecta a ÚNICA conta Google Ads da
-- imoB365 (cartão dela); imobiliária/corretor só monta rascunho de
-- campanha, paga (custo + margem embutida) e acompanha performance —
-- nunca ativa a campanha diretamente, isso fica exclusivo do super_admin,
-- já que o gasto real sai do cartão da própria plataforma.
CREATE TABLE public.google_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  customer_id text,
  connected_at timestamptz,
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Linha única de propósito — não é por tenant, é a conta da plataforma.
  singleton boolean NOT NULL DEFAULT true UNIQUE
);

CREATE TRIGGER google_ads_config_set_updated_at
  BEFORE UPDATE ON public.google_ads_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.google_ads_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.google_ads_config TO anon, authenticated, service_role;

-- Rascunho de campanha criado pelo tenant, pago antes da ativação, e
-- ativado só pelo super_admin (que cria a campanha de verdade na API do
-- Google Ads usando a conta única acima). margem_percentual/
-- orcamento_periodo NUNCA são expostos na tela do tenant (só o
-- valor_com_margem, como "investimento total") — decisão explícita do
-- usuário de não revelar a margem da imoB365 ao cliente final.
CREATE TABLE public.google_ads_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  criado_por uuid,
  nome text NOT NULL,
  palavras_chave text NOT NULL,
  tipo_conteudo text NOT NULL DEFAULT 'search',
  orcamento_periodo numeric NOT NULL CHECK (orcamento_periodo > 0),
  duracao_dias integer NOT NULL CHECK (duracao_dias > 0),
  margem_percentual numeric NOT NULL DEFAULT 30,
  valor_com_margem numeric NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (
    status IN (
      'rascunho', 'aguardando_pagamento', 'aguardando_ativacao',
      'ativa', 'pausada', 'encerrada', 'rejeitada'
    )
  ),
  payment_reference text,
  google_campaign_resource_name text,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_google_ads_campanhas_tenant ON public.google_ads_campanhas(tenant_id, created_at DESC);
CREATE INDEX idx_google_ads_campanhas_status ON public.google_ads_campanhas(status);

CREATE TRIGGER google_ads_campanhas_set_updated_at
  BEFORE UPDATE ON public.google_ads_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trava de segurança pedida explicitamente pelo usuário: só super_admin
-- pode mudar o status pra "ativa"/"rejeitada" (as duas transições que
-- liberariam gasto real ou fechariam a solicitação) — um TRIGGER, não só
-- uma policy, pra fechar a brecha mesmo se uma policy futura for mais
-- permissiva por engano. Mesmo padrão já usado em
-- protect_tenants_exibir_na_home/protect_profile_privileged_cols.
CREATE OR REPLACE FUNCTION public.protect_google_ads_campanha_ativacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('ativa', 'rejeitada') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente o super_admin pode ativar ou rejeitar uma campanha de Google Ads';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_google_ads_campanha_ativacao
  BEFORE UPDATE ON public.google_ads_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.protect_google_ads_campanha_ativacao();

ALTER TABLE public.google_ads_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_ads_campanhas_members_read ON public.google_ads_campanhas
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY google_ads_campanhas_write ON public.google_ads_campanhas
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role)
  );
CREATE POLICY google_ads_campanhas_members_update ON public.google_ads_campanhas
  FOR UPDATE TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY google_ads_campanhas_super_admin_all ON public.google_ads_campanhas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.google_ads_campanhas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_campanhas TO service_role;
