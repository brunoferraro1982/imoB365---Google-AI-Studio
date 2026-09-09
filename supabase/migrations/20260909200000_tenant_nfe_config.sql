-- Emissão de Nota Fiscal Eletrônica de Serviço (NFS-e) — BYO simplificado
-- (API key, não OAuth — confirmado que nenhum provedor grande de NFe/NFSe
-- oferece fluxo de redirecionamento OAuth, ver changelog CLAUDE.md
-- 2026-09-09). Cada tenant cria a PRÓPRIA conta no provedor (Focus NFe
-- recomendado — maior cobertura nacional de NFS-e e melhor custo-benefício
-- pra muitos CNPJs pequenos, ver changelog), registra o próprio CNPJ e
-- certificado digital diretamente no painel do provedor, e cola aqui só o
-- token de API — nunca uma conta operada pelo imoB365 emitindo em nome de
-- vários tenants.
CREATE TABLE public.tenant_nfe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'focus_nfe',
  token text,
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  cnpj_prestador text,
  inscricao_municipal text,
  codigo_municipio_ibge text,
  item_lista_servico text NOT NULL DEFAULT '10.05',
  optante_simples_nacional boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenant_nfe_config_set_updated_at
  BEFORE UPDATE ON public.tenant_nfe_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Mesmo padrão "seguro por padrão" de tenant_assinatura_config: RLS
-- habilitado SEM nenhuma policy (deny-all) — a linha guarda o token de API
-- do tenant, todo acesso passa por server functions usando supabaseAdmin.
ALTER TABLE public.tenant_nfe_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.tenant_nfe_config TO anon, authenticated, service_role;

-- Auditoria de cada nota emitida — nunca apagada, serve pra reconsultar o
-- status (a emissão é assíncrona no Focus NFe: processando -> autorizado
-- ou erro_autorizacao) e reencontrar o link do PDF/XML depois de emitido.
CREATE TABLE public.nfe_emitidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  comissao_id uuid REFERENCES public.comissoes(id) ON DELETE SET NULL,
  referencia text NOT NULL,
  status text NOT NULL DEFAULT 'processando_autorizacao',
  numero text,
  url_danfse text,
  valor_servicos numeric,
  tomador_nome text,
  tomador_documento text,
  erro_mensagem text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_nfe_emitidas_tenant_referencia ON public.nfe_emitidas(tenant_id, referencia);
CREATE INDEX idx_nfe_emitidas_comissao ON public.nfe_emitidas(comissao_id);

CREATE TRIGGER nfe_emitidas_set_updated_at
  BEFORE UPDATE ON public.nfe_emitidas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.nfe_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfe_emitidas_members_read ON public.nfe_emitidas
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY nfe_emitidas_write ON public.nfe_emitidas
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro'::app_role)
  );
CREATE POLICY nfe_emitidas_super_admin_all ON public.nfe_emitidas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.nfe_emitidas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfe_emitidas TO service_role;
