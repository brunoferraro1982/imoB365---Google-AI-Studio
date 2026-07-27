-- Fase 2 do incremento do módulo Financeiro (Venda: sinal/entrada/parcelas),
-- plano estratégico aprovado em 2026-07-26. contratos hoje só tem `valor`
-- total, sem nenhuma forma de registrar/parcelar o pagamento de uma venda —
-- diferente de locação (locacao_repasses) e comissões (comissoes), que já
-- têm cronograma e trigger de geração automática.

-- Campos de negociação de venda (nullable — só fazem sentido pra
-- tipo='venda', e mesmo aí só quando o negócio envolve sinal/entrada/
-- parcelamento; uma venda à vista não usa nenhum dos quatro).
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_sinal numeric,
  ADD COLUMN IF NOT EXISTS valor_entrada numeric,
  ADD COLUMN IF NOT EXISTS numero_parcelas integer,
  ADD COLUMN IF NOT EXISTS data_primeira_parcela date;

DO $$ BEGIN
  CREATE TYPE public.contrato_parcela_tipo AS ENUM ('sinal','entrada','parcela','quitacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- status reaproveita o mesmo enum financeiro_status (pendente/pago/
-- atrasado/cancelado) já usado em lancamentos_financeiros — mesmo
-- vocabulário, mesma automação de inadimplência dá pra estender depois.
CREATE TABLE IF NOT EXISTS public.contrato_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  tipo contrato_parcela_tipo NOT NULL DEFAULT 'parcela',
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  status financeiro_status NOT NULL DEFAULT 'pendente',
  data_pagamento date,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (contrato_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_tenant ON public.contrato_parcelas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_contrato ON public.contrato_parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_status_venc
  ON public.contrato_parcelas(status, data_vencimento);

ALTER TABLE public.contrato_parcelas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_contrato_parcelas_updated
  BEFORE UPDATE ON public.contrato_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS com o padrão já corrigido (admin OU financeiro, + bypass explícito de
-- super_admin) desde o primeiro dia — não repete a classe de bug já
-- encontrada 5x neste histórico (locacao_repasses, empreendimentos, etc.:
-- políticas que esquecem financeiro ou super_admin).
CREATE POLICY "cp_read" ON public.contrato_parcelas
  FOR SELECT TO authenticated
  USING (
    is_member_of_tenant(auth.uid(), tenant_id)
    AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin')
      OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
    )
  );

CREATE POLICY "cp_admin" ON public.contrato_parcelas
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );

CREATE POLICY "cp_super_admin_all" ON public.contrato_parcelas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Geração automática do cronograma ao ativar um contrato de venda — mesmo
-- padrão já validado em produção por tg_gerar_comissao_contrato (dispara na
-- transição pra 'ativo', não duplica se já existir cronograma). Regra:
-- sinal (se houver) + entrada (se houver) vencem na data_inicio; o restante
-- (valor - sinal - entrada) é dividido em parcelas mensais iguais a partir
-- de data_primeira_parcela, com o arredondamento absorvido pela última
-- parcela. numero_parcelas/valor_sinal/valor_entrada nulos ou zero são
-- simplesmente pulados — um contrato sem nenhum desses campos preenchidos
-- não gera nenhuma parcela (a tela cobre a criação manual pra esse caso).
CREATE OR REPLACE FUNCTION public.tg_gerar_parcelas_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante NUMERIC;
  v_num INTEGER;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  v_seq INTEGER := 1;
  i INTEGER;
BEGIN
  IF NEW.tipo = 'venda'
     AND NEW.status = 'ativo'
     AND (OLD.status IS DISTINCT FROM 'ativo') THEN

    IF EXISTS (SELECT 1 FROM public.contrato_parcelas WHERE contrato_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    v_data_base := COALESCE(NEW.data_primeira_parcela, NEW.data_inicio, CURRENT_DATE);

    IF COALESCE(NEW.valor_sinal, 0) > 0 THEN
      INSERT INTO public.contrato_parcelas
        (tenant_id, contrato_id, numero, tipo, valor, data_vencimento, created_by)
      VALUES
        (NEW.tenant_id, NEW.id, v_seq, 'sinal', NEW.valor_sinal,
         COALESCE(NEW.data_inicio, CURRENT_DATE), NEW.created_by);
      v_seq := v_seq + 1;
    END IF;

    IF COALESCE(NEW.valor_entrada, 0) > 0 THEN
      INSERT INTO public.contrato_parcelas
        (tenant_id, contrato_id, numero, tipo, valor, data_vencimento, created_by)
      VALUES
        (NEW.tenant_id, NEW.id, v_seq, 'entrada', NEW.valor_entrada, v_data_base, NEW.created_by);
      v_seq := v_seq + 1;
    END IF;

    v_restante := NEW.valor - COALESCE(NEW.valor_sinal, 0) - COALESCE(NEW.valor_entrada, 0);
    v_num := COALESCE(NEW.numero_parcelas, 0);

    IF v_num > 0 AND v_restante > 0 THEN
      v_valor_parcela := ROUND(v_restante / v_num, 2);
      FOR i IN 1..v_num LOOP
        INSERT INTO public.contrato_parcelas
          (tenant_id, contrato_id, numero, tipo, valor, data_vencimento, created_by)
        VALUES (
          NEW.tenant_id, NEW.id, v_seq, 'parcela',
          CASE WHEN i = v_num THEN v_restante - v_valor_parcela * (v_num - 1) ELSE v_valor_parcela END,
          v_data_base + ((i - 1) || ' months')::interval,
          NEW.created_by
        );
        v_seq := v_seq + 1;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_parcelas_contrato ON public.contratos;
CREATE TRIGGER trg_gerar_parcelas_contrato
  AFTER INSERT OR UPDATE OF status ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_gerar_parcelas_contrato();

-- Ao marcar uma parcela como paga, cria a receita no financeiro — mesmo
-- padrão de tg_comissao_paga_lancamento (BEFORE UPDATE, seta NEW.lancamento_id
-- direto, sem precisar de um segundo UPDATE/recursão).
CREATE OR REPLACE FUNCTION public.tg_parcela_paga_lancamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero_contrato TEXT;
  v_lanc_id UUID;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') AND NEW.lancamento_id IS NULL THEN
    SELECT numero INTO v_numero_contrato FROM public.contratos WHERE id = NEW.contrato_id;

    INSERT INTO public.lancamentos_financeiros (
      tenant_id, tipo, categoria, descricao, valor,
      data_vencimento, data_pagamento, status, contrato_id, created_by
    ) VALUES (
      NEW.tenant_id, 'receita', 'Venda',
      initcap(NEW.tipo::text) || ' — contrato ' || COALESCE(v_numero_contrato, ''),
      NEW.valor,
      NEW.data_vencimento,
      COALESCE(NEW.data_pagamento, CURRENT_DATE),
      'pago', NEW.contrato_id, NEW.created_by
    ) RETURNING id INTO v_lanc_id;

    NEW.lancamento_id := v_lanc_id;
    IF NEW.data_pagamento IS NULL THEN
      NEW.data_pagamento := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parcela_paga_lancamento ON public.contrato_parcelas;
CREATE TRIGGER trg_parcela_paga_lancamento
  BEFORE UPDATE OF status ON public.contrato_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.tg_parcela_paga_lancamento();
