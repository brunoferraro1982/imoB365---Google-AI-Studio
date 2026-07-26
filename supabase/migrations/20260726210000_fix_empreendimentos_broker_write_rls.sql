-- Relato de produção: bruno.ferraro09@hotmail.com (role broker) recebia
-- "new row violates row-level security policy for table empreendimentos"
-- ao tentar cadastrar um empreendimento. Causa raiz: a tabela nunca teve
-- policy de escrita pra membro comum do tenant desde sua criação
-- (20260521191240) — só existia emp_admin (role admin) e emp_super_admin,
-- mesmo padrão de bug já corrigido antes pra imoveis/imovel-fotos/
-- tenant-branding/corretor-fotos/site-widgets (RLS liberada só pra
-- admin/super_admin, corretor comum nunca conseguiu usar a feature em
-- produção). Decisão do usuário: liberar pra qualquer membro do tenant,
-- mesmo padrão já usado em imoveis_broker_write (não restrito à role
-- 'broker' especificamente, já que a política homônima em imoveis também
-- não restringe).
CREATE POLICY "emp_member_write" ON public.empreendimentos
  FOR ALL TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));
