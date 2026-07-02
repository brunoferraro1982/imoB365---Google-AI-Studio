-- Permite que lançamentos financeiros também tenham campos personalizados,
-- reaproveitando o mesmo mecanismo já usado por imóveis: uma coluna jsonb
-- com os valores, chaveados por tenant_custom_fields.chave (entidade =
-- 'lancamento'). Ver src/routes/app.configuracoes.campos.tsx e
-- src/components/financeiro/LancamentoForm.tsx.

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}'::jsonb;
