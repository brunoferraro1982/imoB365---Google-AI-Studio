-- Mesmo depois de corrigir auth_tenant_id() (adicionando SET search_path),
-- INSERTs em plano_contas/centros_custo continuavam falhando com
-- "new row violates row-level security policy" para qualquer usuário sem a
-- role literal 'admin' (broker, financeiro, corretor, atendente, e até
-- super_admin — que só tem a role 'super_admin', não 'admin'). O caminho
-- que passava (pc_admin, baseado em has_role_in_tenant) mascarava o
-- problema só para quem tinha 'admin'; a policy tenant_isolation_* (via
-- auth_tenant_id()) permanece não-funcional na prática para o resto,
-- mesmo com a função corrigida — reproduzido e confirmado repetidas vezes
-- com um usuário role='broker' recém-provisionado.
--
-- Em vez de continuar depurando o motivo exato (suspeita de plano de
-- execução em cache no pooler, não invalidado por CREATE OR REPLACE
-- FUNCTION), troca a policy de isolamento por is_member_of_tenant() — uma
-- função com comportamento já comprovado em produção (usada por pc_read,
-- funcionando para leituras o tempo todo).

DROP POLICY IF EXISTS "tenant_isolation_plano_contas" ON plano_contas;
CREATE POLICY "tenant_isolation_plano_contas"
  ON plano_contas
  USING (is_member_of_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "tenant_isolation_centros_custo" ON centros_custo;
CREATE POLICY "tenant_isolation_centros_custo"
  ON centros_custo
  USING (is_member_of_tenant(auth.uid(), tenant_id));
