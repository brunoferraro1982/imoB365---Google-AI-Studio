-- Aprovação de um lote de ingestão passa a suportar múltiplos destinos ao
-- mesmo tempo (imobiliárias e/ou corretores individuais) — achado real de
-- produção: o seletor de imobiliária ficava vazio sempre que nenhuma
-- construtora_tenant_parceria existia ainda (bloqueava toda aprovação até
-- alguém cadastrar manualmente), e o pedido explícito do usuário foi poder
-- atribuir a mais de um destino de uma vez, cada um virando um rascunho
-- independente (empreendimentos/imoveis só têm um tenant_id cada — schema
-- não muda, um lote aprovado pra N destinos vira N registros separados).
--
-- construtora_ingestao_lotes.empreendimento_id/imovel_id continuam
-- existindo só como referência rápida da ÚLTIMA aprovação processada — o
-- histórico completo (todos os destinos, todos os rascunhos gerados) fica
-- nesta tabela nova.
CREATE TABLE public.construtora_ingestao_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.construtora_ingestao_lotes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  corretor_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  empreendimento_id uuid REFERENCES public.empreendimentos(id) ON DELETE SET NULL,
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  aprovado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.construtora_ingestao_aprovacoes(lote_id);

-- Evita atribuir o mesmo lote duas vezes pro mesmo destino exato. Postgres
-- trata cada NULL como distinto por padrão, o que não bloquearia duas
-- atribuições "só tenant, sem corretor" iguais — por isso o COALESCE pra
-- um sentinel fixo só nesta constraint de unicidade.
CREATE UNIQUE INDEX construtora_ingestao_aprovacoes_destino_key
  ON public.construtora_ingestao_aprovacoes (
    lote_id, tenant_id, COALESCE(corretor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.construtora_ingestao_aprovacoes ENABLE ROW LEVEL SECURITY;

-- Mesmo escopo das demais tabelas desta feature: só super_admin revisa.
CREATE POLICY ingestao_super_admin_all_aprovacoes ON public.construtora_ingestao_aprovacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- GRANT explícito nas 3 roles — lição operacional já documentada no
-- CLAUDE.md pras demais tabelas desta mesma feature.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtora_ingestao_aprovacoes TO anon, authenticated, service_role;

CREATE TRIGGER tg_audit_construtora_ingestao_aprovacoes AFTER INSERT OR UPDATE OR DELETE ON public.construtora_ingestao_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
