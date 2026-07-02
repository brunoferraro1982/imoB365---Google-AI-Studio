-- Bug crítico: auth_tenant_id() foi criada sem `SET search_path = public`
-- (diferente de todas as outras funções SECURITY DEFINER deste projeto,
-- ex. is_member_of_tenant(), has_role_in_tenant()). Sem isso, a referência
-- não-qualificada a `profiles` dentro da função não resolve corretamente,
-- e a função sempre retorna NULL — mesmo quando profiles.tenant_id está
-- populado corretamente.
--
-- Isso quebra silenciosamente TODAS as policies "tenant_isolation_*"
-- (criadas em 20260612121707_rls_audit_and_fixes.sql: imoveis, leads,
-- visitas, contratos, modelos_contrato, plano_contas, centros_custo,
-- lancamentos, comissoes, campanhas, documentos, tenants, profiles,
-- user_roles, tenant_modules, route_aliases) para QUALQUER usuário cujo
-- acesso dependa exclusivamente dessa policy — ou seja, todo mundo exceto
-- quem também tem uma policy mais antiga baseada em role (has_role_in_tenant
-- 'admin', por exemplo), que mascarava o problema nas tabelas onde ela
-- coexiste. Reproduzido e confirmado com um usuário role='broker' (sem
-- 'admin'/'super_admin'): INSERT em plano_contas falhava com
-- "new row violates row-level security policy" mesmo com tenant_id correto.

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;
