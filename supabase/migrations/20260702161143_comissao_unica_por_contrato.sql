-- "Gerar comissão" (app.contratos.$id.tsx) inseria um novo lançamento em
-- lancamentos_financeiros a cada clique, sem checar se já existia um para
-- o mesmo contrato — permitindo múltiplas despesas de comissão duplicadas
-- por contrato. Trava no banco: no máximo um lançamento categoria='comissao'
-- por contrato_id (índice único parcial). A UI também passa a checar antes
-- de inserir, para dar um erro amigável em vez de estourar a constraint.

-- 1) Remove duplicatas existentes antes de criar o índice único, mantendo
--    o lançamento mais antigo de cada contrato.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY contrato_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.lancamentos_financeiros
  WHERE categoria = 'comissao' AND contrato_id IS NOT NULL
)
DELETE FROM public.lancamentos_financeiros
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Trava definitiva: no máximo um lançamento de comissão por contrato.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_comissao_unica_por_contrato
  ON public.lancamentos_financeiros (contrato_id)
  WHERE categoria = 'comissao' AND contrato_id IS NOT NULL;
