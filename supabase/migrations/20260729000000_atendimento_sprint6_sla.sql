-- Central de Atendimento — Sprint 6 (SLA por tenant)
--
-- tenant_atendimento_config já existe desde o Sprint 0 (fundação) — este
-- sprint entrega o cálculo real dos prazos e a detecção de estouro.

-- Generaliza lead_tarefas mais uma vez pra suportar chamados, mesmo padrão
-- já usado pra contratos/cartórios (20260702142319_sla_tarefas_contratos_cartorios.sql).
ALTER TABLE public.lead_tarefas
  ADD COLUMN IF NOT EXISTS chamado_id uuid REFERENCES public.chamados(id) ON DELETE CASCADE;

ALTER TABLE public.lead_tarefas
  DROP CONSTRAINT IF EXISTS lead_tarefas_origem_check;

ALTER TABLE public.lead_tarefas
  ADD CONSTRAINT lead_tarefas_origem_check
  CHECK (
    lead_id IS NOT NULL
    OR contrato_id IS NOT NULL
    OR cartorio_registro_id IS NOT NULL
    OR chamado_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_lead_tarefas_chamado ON public.lead_tarefas(chamado_id);

-- Calcula os prazos de SLA na criação do chamado, a partir da config do
-- próprio tenant (tenant_atendimento_config) — ou do default fixo abaixo
-- pro balcão imoB365 e pra tenants que ainda não configuraram o próprio
-- SLA (mesmo espírito de SLA_CARTORIO_DIAS em slaAlertas.ts: default
-- code-level, sem exigir uma linha de config por tenant). Roda em todo
-- caminho de criação (RPC pública, webhook do WhatsApp, cron de e-mail,
-- inserts manuais do admin/app) sem precisar duplicar a lógica em cada um.
CREATE OR REPLACE FUNCTION public.tg_chamado_sla()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _resp_min integer;
  _resol_h integer;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    SELECT sla_primeira_resposta_minutos, sla_resolucao_horas
      INTO _resp_min, _resol_h
      FROM public.tenant_atendimento_config
      WHERE tenant_id = NEW.tenant_id;
  END IF;

  _resp_min := COALESCE(_resp_min, 240); -- default 4h úteis
  _resol_h := COALESCE(_resol_h, 48); -- default 48h

  IF NEW.sla_prazo_primeira_resposta IS NULL THEN
    NEW.sla_prazo_primeira_resposta := NEW.created_at + make_interval(mins => _resp_min);
  END IF;
  IF NEW.sla_prazo_resolucao IS NULL THEN
    NEW.sla_prazo_resolucao := NEW.created_at + make_interval(hours => _resol_h);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_chamado_sla BEFORE INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.tg_chamado_sla();
