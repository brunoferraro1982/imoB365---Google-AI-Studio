-- Fix: super_admin não conseguia cadastrar unidades de empreendimento
-- Mesmo padrão do fix anterior (empreendimentos)

CREATE POLICY eu_super_admin ON public.empreendimento_unidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
