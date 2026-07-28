-- CLM Sprint 12 — Histórico: audit_log + tg_audit() já existem e já cobrem
-- contratos (bootstrap original) e contrato_partes/contrato_etapas/
-- contrato_dados_pagamento/contrato_documentos/tenant_assinatura_config
-- (sprints anteriores deste programa) — faltam os sub-registros restantes
-- do contrato.
DROP TRIGGER IF EXISTS tg_audit_contrato_parcelas ON public.contrato_parcelas;
CREATE TRIGGER tg_audit_contrato_parcelas
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS tg_audit_contrato_templates ON public.contrato_templates;
CREATE TRIGGER tg_audit_contrato_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS tg_audit_contrato_checklist ON public.contrato_checklist;
CREATE TRIGGER tg_audit_contrato_checklist
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS tg_audit_locacao_garantias ON public.locacao_garantias;
CREATE TRIGGER tg_audit_locacao_garantias
  AFTER INSERT OR UPDATE OR DELETE ON public.locacao_garantias
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

DROP TRIGGER IF EXISTS tg_audit_locacao_reajustes ON public.locacao_reajustes;
CREATE TRIGGER tg_audit_locacao_reajustes
  AFTER INSERT OR UPDATE OR DELETE ON public.locacao_reajustes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
