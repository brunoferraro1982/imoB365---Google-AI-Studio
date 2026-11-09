-- Modelos de contrato escolhidos no cadastro, vinculados ao contrato.
-- O documento é gerado sempre com os dados atuais do contrato (sem cópia congelada).
CREATE TABLE IF NOT EXISTS public.contrato_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.contrato_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, template_id)
);
CREATE INDEX IF NOT EXISTS contrato_modelos_contrato_idx ON public.contrato_modelos (contrato_id);

ALTER TABLE public.contrato_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_read ON public.contrato_modelos FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY cm_write ON public.contrato_modelos FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'financeiro'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'juridico'::app_role)
    OR public.has_role_in_tenant(auth.uid(), tenant_id, 'financeiro'::app_role)
  );

-- Tabelas criadas pelo supabase_admin em produção precisam de grant explícito.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_modelos TO authenticated, service_role;
