-- Locação: outras taxas mensais por contrato (lista de {descricao, valor}).
-- Aditiva e segura: coluna nova com padrão '[]'; nenhuma linha existente é alterada.
-- Aplicar somente após aprovação (dev primeiro, produção depois). Não aplicar automaticamente.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS taxas_adicionais jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contratos.taxas_adicionais IS 'Outras taxas mensais da locação: array de {descricao: text, valor: number}. Somadas ao aluguel, IPTU, condomínio e seguro no total mensal.';
