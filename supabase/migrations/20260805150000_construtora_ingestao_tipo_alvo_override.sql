-- Achado real: um lote descoberto numa fonte marcada como "Lançamento"
-- (tipo_alvo=empreendimento) pode na prática ser um imóvel avulso comum
-- (ex.: "Residencial Telavive" era 1 unidade única à venda, não um
-- lançamento com várias unidades) — o tipo_alvo da FONTE é só um padrão,
-- nem sempre reflete a natureza real de cada lote individual dela.
--
-- Coluna opcional pra sobrescrever, por lote, o tipo_alvo herdado da
-- fonte — escolhido pelo super_admin na revisão, antes de aprovar. NULL
-- (padrão) mantém o comportamento de sempre (usa o tipo_alvo da fonte).
ALTER TABLE public.construtora_ingestao_lotes
  ADD COLUMN tipo_alvo_override text
  CHECK (tipo_alvo_override IN ('empreendimento', 'imovel'));
