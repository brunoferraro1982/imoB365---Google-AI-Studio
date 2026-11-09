-- RG da parte e dados do cônjuge (casado/união estável).
ALTER TABLE public.contrato_partes
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS conjuge jsonb;
