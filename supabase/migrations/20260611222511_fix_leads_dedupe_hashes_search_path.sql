-- BUG-14: Fix search_path da função leads_set_dedupe_hashes
-- O pgcrypto está instalado no schema 'extensions' (padrão Supabase)
-- mas o search_path da função não incluía 'extensions', causando:
-- "function digest(text, unknown) does not exist"
-- ao tentar inserir leads via formulário público do portal.
ALTER FUNCTION public.leads_set_dedupe_hashes()
  SET search_path = public, extensions;
