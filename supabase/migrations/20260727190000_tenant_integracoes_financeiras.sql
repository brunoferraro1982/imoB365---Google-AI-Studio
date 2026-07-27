-- Fase 4 do módulo Financeiro — estrutura administrativa de conciliação
-- bancária/ERP. Diferente do Mercado Pago (OAuth real, `access_token`
-- verdadeiro), aqui o pedido explícito do usuário foi "fornecer o modelo e
-- infra pra conexão, não necessário conectar": o admin do tenant cadastra
-- qual banco/ERP pretende usar e preenche dados de configuração, sem que
-- nenhuma chamada real à API externa aconteça ainda. Por não lidar com
-- segredo de terceiro validado nem chamada externa, a escrita é direta do
-- client (RLS admin), mesmo padrão de `plano_contas`/`centros_custo` —
-- não precisa do padrão de server function + deny-all usado em
-- `tenant_mercadopago_accounts`.
CREATE TABLE public.tenant_integracoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('conciliacao_bancaria', 'erp')),
  provider text NOT NULL,
  nome_exibicao text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_integracoes_financeiras_tenant
  ON public.tenant_integracoes_financeiras(tenant_id);

ALTER TABLE public.tenant_integracoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integracoes_financeiras_members_read" ON public.tenant_integracoes_financeiras
  FOR SELECT TO authenticated
  USING (
    is_member_of_tenant(auth.uid(), tenant_id)
    AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin')
      OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
    )
  );
CREATE POLICY "integracoes_financeiras_admin_write" ON public.tenant_integracoes_financeiras
  FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "integracoes_financeiras_super_admin_all" ON public.tenant_integracoes_financeiras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_integracoes_financeiras_updated
  BEFORE UPDATE ON public.tenant_integracoes_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
