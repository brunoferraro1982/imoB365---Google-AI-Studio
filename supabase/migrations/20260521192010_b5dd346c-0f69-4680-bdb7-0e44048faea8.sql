
-- Tarefas de leads
CREATE TABLE public.lead_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  responsavel_user_id uuid,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'tarefa', -- tarefa|ligacao|whatsapp|email|visita|reuniao
  prioridade text NOT NULL DEFAULT 'media', -- baixa|media|alta
  status text NOT NULL DEFAULT 'pendente', -- pendente|concluida|cancelada
  prazo timestamptz,
  concluida_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_tarefas_tenant_status ON public.lead_tarefas(tenant_id, status, prazo);
CREATE INDEX idx_lead_tarefas_lead ON public.lead_tarefas(lead_id, created_at DESC);
CREATE INDEX idx_lead_tarefas_resp ON public.lead_tarefas(responsavel_user_id, status, prazo) WHERE status = 'pendente';

ALTER TABLE public.lead_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY lt_read ON public.lead_tarefas FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY lt_insert ON public.lead_tarefas FOR INSERT TO authenticated
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY lt_update ON public.lead_tarefas FOR UPDATE TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR responsavel_user_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY lt_delete ON public.lead_tarefas FOR DELETE TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TRIGGER trg_lead_tarefas_updated_at
  BEFORE UPDATE ON public.lead_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Tracking pixels
ALTER TABLE public.tenant_site_settings
  ADD COLUMN IF NOT EXISTS ga4_id text,
  ADD COLUMN IF NOT EXISTS gtm_id text,
  ADD COLUMN IF NOT EXISTS fb_pixel_id text,
  ADD COLUMN IF NOT EXISTS google_ads_id text,
  ADD COLUMN IF NOT EXISTS hotjar_id text,
  ADD COLUMN IF NOT EXISTS head_custom_html text;
