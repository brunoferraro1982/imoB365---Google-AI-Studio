-- CLM Sprint 3 — Workflow: introduz o conceito de etapa do ciclo de vida
-- do contrato (captacao -> analise -> documentacao -> juridico ->
-- assinatura -> ativacao -> financeiro -> administracao -> encerramento),
-- sem substituir o enum contrato_status existente (que já tem automação
-- real via trigger em cima de 'ativo' — tg_gerar_comissao_contrato,
-- tg_gerar_parcelas_contrato, tg_webhook_contrato continuam intocados).
--
-- 'etapa' é texto livre (não enum de banco), validado em Zod na camada de
-- aplicação — permite customização por tenant no futuro sem precisar de
-- nova migration pra cada etapa nova.

CREATE TABLE public.contrato_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contrato_etapas_contrato ON public.contrato_etapas(contrato_id, iniciada_em DESC);

ALTER TABLE public.contrato_etapas ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de RLS já usado em contratos (admin OU juridico OU
-- financeiro, corrigido no Sprint 0).
CREATE POLICY "contrato_etapas_members_read" ON public.contrato_etapas
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY "contrato_etapas_write" ON public.contrato_etapas
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );
CREATE POLICY "contrato_etapas_super_admin_all" ON public.contrato_etapas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS tg_audit_contrato_etapas ON public.contrato_etapas;
CREATE TRIGGER tg_audit_contrato_etapas
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_etapas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- contratos ganha etapa_atual — coluna nova com default seguro, não quebra
-- nenhum contrato existente.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS etapa_atual text NOT NULL DEFAULT 'captacao';

-- Backfill: contratos já ativos/encerrados/cancelados hoje não devem
-- aparecer como "captação" (isso confundiria o stepper na UI) — mapeamento
-- conservador baseado no status macro que já existe.
UPDATE public.contratos SET etapa_atual = 'ativacao' WHERE status = 'ativo';
UPDATE public.contratos SET etapa_atual = 'encerramento' WHERE status IN ('encerrado', 'cancelado', 'rescindido');
