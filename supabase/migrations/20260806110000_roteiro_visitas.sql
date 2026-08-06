-- Roteiro de Visitas: Kanban de visitas com colunas de etapa configuráveis
-- por tenant. Reaproveita a tabela visitas já existente (imovel_id, lead_id,
-- corretor_id, data_hora, observacoes) — não mexe no enum visita_status
-- (agendada/confirmada/realizada/cancelada/nao_compareceu), que já tem
-- efeitos colaterais automáticos (trigger de notificação, RPC de check-in
-- por QR code). O drag-and-drop do Kanban grava só em roteiro_etapa_id, uma
-- coluna nova e independente. Espelha lead_funis/lead_funil_etapas (mesmo
-- padrão de RLS já validado nesse projeto).

CREATE TABLE public.roteiro_visita_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roteiro_visita_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteiro_visita_etapas members read"
  ON public.roteiro_visita_etapas FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY "roteiro_visita_etapas admin write"
  ON public.roteiro_visita_etapas FOR INSERT TO authenticated
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "roteiro_visita_etapas admin update"
  ON public.roteiro_visita_etapas FOR UPDATE TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "roteiro_visita_etapas admin delete"
  ON public.roteiro_visita_etapas FOR DELETE TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "roteiro_visita_etapas super_admin all"
  ON public.roteiro_visita_etapas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiro_visita_etapas TO authenticated;

ALTER TABLE public.visitas
  ADD COLUMN roteiro_etapa_id uuid REFERENCES public.roteiro_visita_etapas(id) ON DELETE SET NULL;
