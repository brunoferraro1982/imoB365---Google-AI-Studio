-- Feature: curadoria da seção "Corretores e Imobiliárias parceiras" da home
-- pública (src/routes/index.tsx). Hoje qualquer tenant com status
-- active/trial aparece ali, sem nenhuma aprovação — a intenção é que essa
-- vitrine mostre só parceiros "premium", liberados manualmente pelo
-- super_admin em /admin/tenants.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS exibir_na_home boolean NOT NULL DEFAULT false;

-- Sem RLS nova: tenants_super_admin_all (FOR ALL, has_role(...,'super_admin'))
-- já cobre a escrita do super_admin em qualquer coluna. Mas tenants_admin_update
-- permite UPDATE na linha inteira pro admin do próprio tenant, sem
-- granularidade de coluna — sem essa trigger, um admin comum poderia se
-- auto-aprovar direto via client, o que descumpriria a exigência de que só
-- o super_admin libere a exibição. Mesmo padrão já usado em
-- protect_profile_privileged_cols() (migration 20260625000011), reaproveitando
-- o helper is_super_admin_safe() já existente no banco.
CREATE OR REPLACE FUNCTION public.protect_tenants_exibir_na_home()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT public.is_super_admin_safe() THEN
    IF NEW.exibir_na_home IS DISTINCT FROM OLD.exibir_na_home THEN
      RAISE EXCEPTION 'Alteracao de exibir_na_home restrita a super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_protect_tenants_exibir_na_home ON public.tenants;
CREATE TRIGGER tg_protect_tenants_exibir_na_home
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.protect_tenants_exibir_na_home();
