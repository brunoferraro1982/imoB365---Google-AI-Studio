-- Dedupe de mídias descobertas — mesmo padrão de captacao_listings
-- (UNIQUE(tenant_id, fonte, external_id)): sem essa constraint, rodar a
-- sincronização de novo reinseriria a mesma mídia a cada ciclo em vez de
-- só confirmar que ela ainda existe.
ALTER TABLE public.construtora_ingestao_midias
  ADD CONSTRAINT construtora_ingestao_midias_lote_drive_id_key UNIQUE (lote_id, origem_drive_id);
