-- CLM Sprint 5 — Garantias: nenhuma migration de schema necessária
-- (locacao_garantias já existe desde 2026-05-21, schema correto) — só o
-- fix de RLS já identificado e adiado no Sprint 4: a família locacao_*
-- inteira nunca teve policy de bypass pra super_admin.
CREATE POLICY "lg_super_admin_all" ON public.locacao_garantias
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Mesmo padrão do Sprint 4 (contratos/contrato_parcelas já tinham
-- financeiro, locacao_reajustes ganhou no Sprint 4) — garantias é dado
-- financeiro/jurídico por natureza (valor, vencimento de seguro-fiança).
DROP POLICY IF EXISTS "lg_admin" ON public.locacao_garantias;
CREATE POLICY "lg_admin" ON public.locacao_garantias
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );
