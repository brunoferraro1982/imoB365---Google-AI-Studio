-- Enum de status de comissão
CREATE TYPE public.comissao_status AS ENUM ('a_pagar', 'paga', 'cancelada');

-- Tabela de comissões
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  corretor_id UUID NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  percentual NUMERIC,
  valor NUMERIC NOT NULL DEFAULT 0,
  status comissao_status NOT NULL DEFAULT 'a_pagar',
  data_prevista DATE,
  data_pagamento DATE,
  lancamento_id UUID REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_comissoes_tenant ON public.comissoes(tenant_id);
CREATE INDEX idx_comissoes_corretor ON public.comissoes(corretor_id);
CREATE INDEX idx_comissoes_contrato ON public.comissoes(contrato_id);
CREATE INDEX idx_comissoes_status ON public.comissoes(status);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- Admin do tenant gerencia
CREATE POLICY "comissoes_admin_write" ON public.comissoes
  TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

-- Membros leem; corretor só vê o que é seu, admin vê tudo
CREATE POLICY "comissoes_members_read" ON public.comissoes FOR SELECT
  TO authenticated
  USING (
    is_member_of_tenant(auth.uid(), tenant_id) AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.id = comissoes.corretor_id AND c.user_id = auth.uid()
      )
    )
  );

-- Super-admin total
CREATE POLICY "comissoes_super_admin_all" ON public.comissoes
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_comissoes_updated
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Geração automática quando contrato vira "ativo"
CREATE OR REPLACE FUNCTION public.tg_gerar_comissao_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perc NUMERIC;
  v_valor NUMERIC;
  v_corretor_padrao NUMERIC;
BEGIN
  IF NEW.status = 'ativo'
     AND (OLD.status IS DISTINCT FROM 'ativo')
     AND NEW.corretor_id IS NOT NULL THEN

    -- Não duplicar
    IF EXISTS (SELECT 1 FROM public.comissoes WHERE contrato_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT comissao_padrao INTO v_corretor_padrao
    FROM public.corretores WHERE id = NEW.corretor_id;

    v_perc := COALESCE(NEW.comissao_percentual, v_corretor_padrao);
    v_valor := COALESCE(
      NEW.comissao_valor,
      CASE WHEN v_perc IS NOT NULL THEN ROUND((NEW.valor * v_perc / 100)::numeric, 2) ELSE 0 END
    );

    INSERT INTO public.comissoes (
      tenant_id, contrato_id, corretor_id, percentual, valor, status, data_prevista, created_by
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.corretor_id, v_perc, v_valor, 'a_pagar',
      COALESCE(NEW.data_inicio, CURRENT_DATE), NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_comissao_contrato
  AFTER INSERT OR UPDATE OF status ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_gerar_comissao_contrato();

-- Ao marcar paga, cria despesa no financeiro
CREATE OR REPLACE FUNCTION public.tg_comissao_paga_lancamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_lanc_id UUID;
BEGIN
  IF NEW.status = 'paga' AND (OLD.status IS DISTINCT FROM 'paga') AND NEW.lancamento_id IS NULL THEN
    SELECT nome INTO v_nome FROM public.corretores WHERE id = NEW.corretor_id;

    INSERT INTO public.lancamentos_financeiros (
      tenant_id, tipo, categoria, descricao, valor,
      data_vencimento, data_pagamento, status, contrato_id, corretor_id, created_by
    ) VALUES (
      NEW.tenant_id, 'despesa', 'Comissão',
      'Comissão — ' || COALESCE(v_nome, 'corretor'),
      NEW.valor,
      COALESCE(NEW.data_pagamento, CURRENT_DATE),
      COALESCE(NEW.data_pagamento, CURRENT_DATE),
      'pago', NEW.contrato_id, NEW.corretor_id, NEW.created_by
    ) RETURNING id INTO v_lanc_id;

    NEW.lancamento_id := v_lanc_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comissao_paga_lancamento
  BEFORE UPDATE OF status ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_comissao_paga_lancamento();