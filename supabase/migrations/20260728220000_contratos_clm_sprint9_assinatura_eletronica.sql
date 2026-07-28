-- CLM Sprint 9 — Assinatura Eletrônica: hoje o painel "ClickSign" em
-- app.contratos.$id.tsx é 100% simulado (setTimeout, sem nenhuma chamada
-- HTTP real) e contratos.assinatura_status nunca teve migration própria
-- (aplicado via Studio manualmente, mesmo padrão de drift já documentado
-- várias vezes neste projeto). Decisão confirmada: BYO por tenant — a
-- plataforma fornece o harness (config + webhook), cada tenant conecta sua
-- própria conta DocuSign/Clicksign/ZapSign/gov.br/ICP-Brasil.

-- Formaliza contratos.assinatura_status (fecha o gap de schema-history).
-- Normaliza qualquer valor fora do enum de 4 estados antes de travar a
-- constraint (defensivo, não deve encontrar nada em produção/dev).
UPDATE public.contratos
  SET assinatura_status = 'rascunho'
  WHERE assinatura_status IS NULL
     OR assinatura_status NOT IN ('rascunho', 'enviado', 'assinado_parcial', 'assinado_total');

ALTER TABLE public.contratos
  ALTER COLUMN assinatura_status SET DEFAULT 'rascunho',
  ALTER COLUMN assinatura_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contratos_assinatura_status_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_assinatura_status_check
      CHECK (assinatura_status IN ('rascunho', 'enviado', 'assinado_parcial', 'assinado_total'));
  END IF;
END $$;

-- Correlaciona um envio de assinatura no provedor externo com a parte do
-- contrato — necessário pro webhook genérico saber qual contrato_partes
-- atualizar quando o provedor confirmar.
ALTER TABLE public.contrato_partes
  ADD COLUMN IF NOT EXISTS assinatura_referencia_externa text;
CREATE INDEX IF NOT EXISTS idx_contrato_partes_ref_externa
  ON public.contrato_partes(assinatura_referencia_externa)
  WHERE assinatura_referencia_externa IS NOT NULL;

-- contratos.assinatura_status vira DERIVADO de contrato_partes.assinatura_status
-- (todos assinados = assinado_total) — deixa de ser gravado direto pelo
-- client (ver refatoração de app.contratos.$id.tsx neste mesmo sprint).
CREATE OR REPLACE FUNCTION public.contratos_derivar_assinatura_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _contrato_id uuid := COALESCE(NEW.contrato_id, OLD.contrato_id);
  _total int;
  _assinados int;
  _enviados int;
  _novo_status text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE assinatura_status = 'assinado'),
         count(*) FILTER (WHERE assinatura_status IN ('enviado', 'assinado'))
    INTO _total, _assinados, _enviados
    FROM public.contrato_partes
    WHERE contrato_id = _contrato_id;

  _novo_status := CASE
    WHEN _total > 0 AND _assinados = _total THEN 'assinado_total'
    WHEN _assinados > 0 THEN 'assinado_parcial'
    WHEN _enviados > 0 THEN 'enviado'
    ELSE 'rascunho'
  END;

  UPDATE public.contratos SET assinatura_status = _novo_status WHERE id = _contrato_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tg_contrato_partes_derivar_assinatura ON public.contrato_partes;
CREATE TRIGGER tg_contrato_partes_derivar_assinatura
  AFTER INSERT OR UPDATE OF assinatura_status OR DELETE ON public.contrato_partes
  FOR EACH ROW EXECUTE FUNCTION public.contratos_derivar_assinatura_status();

-- Config de assinatura eletrônica por tenant (BYO — nunca conta mestre da
-- imoB365). Mesma observação já feita em tenant_integracoes_financeiras.config
-- (Fase 4 Financeiro): sem infra de criptografia no projeto hoje, o segredo
-- fica em texto plano protegido só por RLS admin-only — mesmo trade-off já
-- aceito ali, não uma regressão nova.
CREATE TABLE public.tenant_assinatura_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('docusign', 'clicksign', 'zapsign', 'gov_br', 'icp_brasil', 'outro')),
  api_key text,
  webhook_secret text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_assinatura_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY tac_admin ON public.tenant_assinatura_config
  FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE POLICY tac_super_admin_all ON public.tenant_assinatura_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_assinatura_config TO authenticated;

DROP TRIGGER IF EXISTS tg_tenant_assinatura_config_updated ON public.tenant_assinatura_config;
CREATE TRIGGER tg_tenant_assinatura_config_updated
  BEFORE UPDATE ON public.tenant_assinatura_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_audit_tenant_assinatura_config ON public.tenant_assinatura_config;
CREATE TRIGGER tg_audit_tenant_assinatura_config
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_assinatura_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
