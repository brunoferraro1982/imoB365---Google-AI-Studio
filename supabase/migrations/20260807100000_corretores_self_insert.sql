-- Cartão Virtual: cadastro direto do próprio cartão, sem depender do admin
-- (achado de QA — antes só admin/super_admin podiam INSERT em corretores).
-- Espelha corretores_self_update, mas para criação: qualquer membro do
-- tenant pode criar exatamente 1 corretor vinculado à própria conta.
--
-- Índice único (tenant_id,user_id) é o cap estrutural pedido: "quantidade
-- de cartões = quantidade de acessos ao sistema" — 1 usuário nunca pode ter
-- mais de 1 cartão no mesmo tenant. Corretores órfãos (user_id NULL,
-- criados fora do fluxo de convite) não são afetados.
CREATE UNIQUE INDEX corretores_unique_user_per_tenant
  ON public.corretores(tenant_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE POLICY corretores_self_insert ON public.corretores
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_member_of_tenant(auth.uid(), tenant_id));
