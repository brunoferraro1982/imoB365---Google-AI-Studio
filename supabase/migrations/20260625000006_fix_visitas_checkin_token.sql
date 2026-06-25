-- Fix: gen_random_bytes() não encontrada — pgcrypto está no schema 'extensions'
-- Qualificar a chamada com extensions.gen_random_bytes()

CREATE OR REPLACE FUNCTION public.visitas_set_checkin_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkin_token IS NULL THEN
    NEW.checkin_token := encode(extensions.gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$$;
