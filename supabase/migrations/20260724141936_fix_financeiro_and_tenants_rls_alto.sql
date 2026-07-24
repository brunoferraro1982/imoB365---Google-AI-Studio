-- Dois achados de severidade Alta da auditoria de segurança de 2026-07-24.

-- 1) lancamentos_financeiros: a policy de leitura só checava se o usuário
-- era membro do tenant, sem checar o papel — qualquer membro (inclusive
-- atendente, que a matriz de permissões de src/lib/permissions.ts diz que
-- não deveria ter acesso a financeiro) via o razão financeiro completo.
-- Corrigido pro mesmo padrão já usado em `comissoes` (admin/financeiro
-- explícitos; super_admin já é coberto por outra policy separada).
DROP POLICY IF EXISTS "lanc_members_read" ON public.lancamentos_financeiros;

CREATE POLICY "lanc_members_read" ON public.lancamentos_financeiros
  FOR SELECT
  USING (
    is_member_of_tenant(auth.uid(), tenant_id)
    AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin')
      OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
    )
  );

-- 2) tenants: a policy tenants_admin_update liberava UPDATE na linha inteira
-- de tenants (inclusive plano_slug/payment_status) tanto pra admin quanto
-- pra broker — qualquer corretor comum conseguia trocar o próprio tenant
-- pra Free ou iniciar checkout pago sem ser admin. Restringe a admin apenas
-- (super_admin já é coberto por outra policy separada).
DROP POLICY IF EXISTS "tenants_admin_update" ON public.tenants;

CREATE POLICY "tenants_admin_update" ON public.tenants
  FOR UPDATE
  USING (has_role_in_tenant(auth.uid(), id, 'admin'))
  WITH CHECK (has_role_in_tenant(auth.uid(), id, 'admin'));
