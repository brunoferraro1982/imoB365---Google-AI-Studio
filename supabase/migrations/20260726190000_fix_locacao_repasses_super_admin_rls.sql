-- Achado real durante o teste da prestação de contas: a migration
-- 20260726150000 (ativação de locacao_repasses) criou as policies lr_read/
-- lr_admin exigindo admin/financeiro em user_roles, mas esqueceu a policy
-- de bypass pra super_admin que TODAS as outras tabelas financeiro-
-- adjacentes já têm (lancamentos_financeiros.lanc_super_admin_all,
-- contratos.contratos_super_admin_all, etc.) — confirmado ao vivo: uma
-- sessão de super_admin sem role admin/financeiro atribuída nesse tenant
-- especificamente não conseguia ver repasses que existiam de verdade no
-- banco (confirmado via service role que a linha existia).
CREATE POLICY "lr_super_admin_all" ON public.locacao_repasses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
