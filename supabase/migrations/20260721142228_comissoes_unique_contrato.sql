-- /app/comissoes: dados não podiam ser editados/apagados, e não tinham
-- relacionamento visível com o módulo de contratos — 100% das comissões em
-- produção tinham contrato_id nulo, porque a única forma de criar uma
-- comissão pela UI era o trigger automático (trg_gerar_comissao_contrato) e
-- não existia formulário manual; o botão "Gerar comissão" em
-- app.contratos.$id.tsx gravava direto em lancamentos_financeiros, uma
-- segunda fonte desconectada da tabela comissoes.
--
-- Agora que existe um formulário manual (ComissaoForm) exigindo contrato,
-- e o botão do contrato foi consolidado para passar por ele, replica a
-- mesma trava que já existe em lancamentos_financeiros (ver migration
-- 20260702161143_comissao_unica_por_contrato.sql) para a tabela comissoes:
-- no máximo uma comissão por contrato.
CREATE UNIQUE INDEX IF NOT EXISTS idx_comissoes_unica_por_contrato
  ON public.comissoes (contrato_id)
  WHERE contrato_id IS NOT NULL;
