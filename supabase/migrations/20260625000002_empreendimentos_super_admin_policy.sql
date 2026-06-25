-- Fix: super_admin não conseguia criar empreendimentos
-- A policy emp_admin só cobria has_role_in_tenant(..., 'admin')
-- super_admin precisa de policy própria via has_role()

CREATE POLICY emp_super_admin ON public.empreendimentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
