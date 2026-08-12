-- Fase 2 do Assistente de importação de construtoras: extração de imóvel a
-- partir do LINK do anúncio no site da construtora (JSON-LD/OpenGraph + IA),
-- caindo na mesma revisão da Fase 1.
--
-- Duas origens de ingestão passam a coexistir:
--   * 'linktree' — o crawl Linktree → Google Drive já existente (default).
--   * 'url'      — uma fonte SINTÉTICA por construtora (ativo=false, ignorada
--                  pelo cron `processarIngestao`, que só varre ativo=true),
--                  usada só como "pasta" pros lotes extraídos de um link
--                  avulso. Fica escondida da lista de fontes periódicas na UI.
--
-- As mídias de um lote de URL não vêm do Drive — são URLs de imagem externas
-- (og:image / JSON-LD image / <img> da própria página). `origem_url` guarda
-- essa URL; `origem_drive_id` fica NULL. A cópia pro bucket público e a
-- geração de thumbnail passam a baixar dessa URL quando `origem_drive_id` é
-- NULL (ver copiarMidiasParaBucket / obterThumbnailsFrescos).
--
-- Só ALTER de tabela existente — os GRANT/RLS das 3 tabelas (aplicados na
-- migration 20260730100000) já cobrem as colunas novas, não precisa re-GRANT.

ALTER TABLE public.construtora_fontes_ingestao
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'linktree';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'construtora_fontes_ingestao'
      AND constraint_name = 'construtora_fontes_ingestao_origem_check'
  ) THEN
    ALTER TABLE public.construtora_fontes_ingestao
      ADD CONSTRAINT construtora_fontes_ingestao_origem_check
      CHECK (origem IN ('linktree', 'url'));
  END IF;
END $$;

ALTER TABLE public.construtora_ingestao_midias
  ADD COLUMN IF NOT EXISTS origem_url text;

-- Dedupe de imagem externa por lote (mesmo espírito da unique de origem_drive_id
-- já existente) — parcial porque as mídias do Drive têm origem_url NULL.
CREATE UNIQUE INDEX IF NOT EXISTS construtora_ingestao_midias_lote_origem_url_key
  ON public.construtora_ingestao_midias (lote_id, origem_url)
  WHERE origem_url IS NOT NULL;
