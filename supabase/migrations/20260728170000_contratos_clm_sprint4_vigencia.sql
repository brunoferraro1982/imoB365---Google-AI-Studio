-- CLM Sprint 4 — Vigência: hoje contratos só tem data_inicio/data_fim.
-- Colunas aditivas nullable, nenhum contrato existente é afetado.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS carencia_dias integer,
  ADD COLUMN IF NOT EXISTS renovacao_automatica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_renovacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_aviso_previo_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_rescisao_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer;

-- locacao_reajustes ganha sua primeira UI real neste sprint — achados reais
-- de RLS confirmados testando ao vivo:
-- 1) a policy de escrita original (2026-05-21) só liberava 'admin', sem a
--    exceção de 'financeiro' que o resto das tabelas financeiras do CLM já
--    recebeu (mesma classe de bug já corrigida em contratos/
--    contrato_parcelas);
-- 2) mais grave: a família locacao_* inteira (repasses/vistorias/garantias/
--    ordens_servico/reajustes) nunca teve policy de bypass pra
--    super_admin, diferente de contratos/contrato_parcelas — confirmado
--    testando ao vivo (INSERT real falhou com "new row violates row-level
--    security policy" numa sessão super_admin). Corrigido aqui só pra
--    locacao_reajustes (escopo deste sprint); locacao_garantias recebe a
--    mesma correção no Sprint 5, quando ganha sua primeira UI.
DROP POLICY IF EXISTS "lre_admin" ON public.locacao_reajustes;
CREATE POLICY "lre_admin" ON public.locacao_reajustes
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );
CREATE POLICY "lre_super_admin_all" ON public.locacao_reajustes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
