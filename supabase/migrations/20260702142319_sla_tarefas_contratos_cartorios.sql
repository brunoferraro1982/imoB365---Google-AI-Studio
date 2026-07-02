-- Generaliza lead_tarefas para também suportar tarefas de SLA vinculadas a
-- contratos (vencimento) e registros de cartório (parados), direcionadas ao
-- corretor responsável. lead_id passa a ser opcional; a tarefa deve estar
-- vinculada a pelo menos uma origem (lead, contrato ou registro de cartório).

ALTER TABLE public.lead_tarefas
  ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE public.lead_tarefas
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cartorio_registro_id uuid REFERENCES public.cartorio_registros(id) ON DELETE CASCADE;

ALTER TABLE public.lead_tarefas
  DROP CONSTRAINT IF EXISTS lead_tarefas_origem_check;

ALTER TABLE public.lead_tarefas
  ADD CONSTRAINT lead_tarefas_origem_check
  CHECK (lead_id IS NOT NULL OR contrato_id IS NOT NULL OR cartorio_registro_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_lead_tarefas_contrato ON public.lead_tarefas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_lead_tarefas_cartorio ON public.lead_tarefas(cartorio_registro_id);
