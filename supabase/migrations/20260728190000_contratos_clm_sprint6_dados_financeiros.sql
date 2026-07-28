-- CLM Sprint 6 — Dados Financeiros: hoje contratos só tem valor,
-- comissao_percentual/valor, valor_sinal/entrada. Faltam condomínio/IPTU/
-- seguro (hoje só existem como texto livre no template impresso), dia de
-- vencimento do aluguel (só existe no nível de parcela/repasse) e centro de
-- custo (hoje só existe em lancamentos_financeiros). Colunas aditivas,
-- nenhum contrato existente é afetado.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_condominio numeric,
  ADD COLUMN IF NOT EXISTS valor_iptu numeric,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

-- Dados bancários/PIX pro repasse ao proprietário — hoje locacao_repasses
-- registra que foi repassado, mas não tem pra onde mandar o valor.
CREATE TABLE public.contrato_dados_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo_chave_pix text,
  chave_pix text,
  banco text,
  agencia text,
  conta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contrato_id)
);
CREATE INDEX idx_contrato_dados_pagamento_contrato ON public.contrato_dados_pagamento(contrato_id);

ALTER TABLE public.contrato_dados_pagamento ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão já estabelecido nesta sessão: admin/financeiro têm escrita,
-- leitura restrita também a admin/financeiro (são dados bancários
-- sensíveis, diferente de contrato_partes/locacao_garantias que qualquer
-- membro do tenant pode ler) + bypass de super_admin.
CREATE POLICY "contrato_dados_pagamento_read" ON public.contrato_dados_pagamento
  FOR SELECT TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );
CREATE POLICY "contrato_dados_pagamento_write" ON public.contrato_dados_pagamento
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );
CREATE POLICY "contrato_dados_pagamento_super_admin_all" ON public.contrato_dados_pagamento
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_dados_pagamento TO authenticated;

CREATE TRIGGER trg_contrato_dados_pagamento_updated
  BEFORE UPDATE ON public.contrato_dados_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_audit_contrato_dados_pagamento ON public.contrato_dados_pagamento;
CREATE TRIGGER tg_audit_contrato_dados_pagamento
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_dados_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- Taxa administrativa padrão do tenant — resolve o gap real encontrado em
-- locacaoRepasses.ts (taxa_admin sempre 0 hoje, sem fallback configurável).
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS taxa_admin_padrao_percentual numeric;
