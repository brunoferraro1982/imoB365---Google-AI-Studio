-- Locação: taxa de administração por contrato e índice de reajuste.
-- Aditiva e segura: colunas novas, nulas ou com padrão; nenhuma linha existente é alterada.
-- Aplicar somente após aprovação (dev primeiro, produção depois). Não aplicar automaticamente.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS taxa_administracao_percentual numeric(5,2),
  ADD COLUMN IF NOT EXISTS indice_reajuste text NOT NULL DEFAULT 'IPCA';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_taxa_administracao_faixa,
  ADD CONSTRAINT contratos_taxa_administracao_faixa
    CHECK (taxa_administracao_percentual IS NULL OR (taxa_administracao_percentual >= 0 AND taxa_administracao_percentual <= 100));

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_indice_reajuste_valido,
  ADD CONSTRAINT contratos_indice_reajuste_valido
    CHECK (indice_reajuste IN ('IPCA', 'IGP-M', 'INPC'));

COMMENT ON COLUMN public.contratos.taxa_administracao_percentual IS 'Taxa de administração da locação (%). Nulo para contratos que não são de locação.';
COMMENT ON COLUMN public.contratos.indice_reajuste IS 'Índice de reajuste anual do aluguel (IPCA, IGP-M ou INPC).';

-- Dados cadastrais das partes (contrato de locação): data de nascimento e CRECI do procurador.
ALTER TABLE public.contrato_partes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS creci text;

COMMENT ON COLUMN public.contrato_partes.data_nascimento IS 'Data de nascimento da parte (pessoa física), para o contrato.';
COMMENT ON COLUMN public.contrato_partes.creci IS 'Número do CRECI, quando a parte for corretor procurador.';
