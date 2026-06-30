-- Fix: auto-aprovação Free dispara antes do onboarding porque plano_pretendido
-- é NULL → coalesce(null,'free') = 'free' → aprovado = true.
-- Agora exige que tipo_usuario esteja preenchido (onboarding concluído).

-- 1. Dropar trigger para poder fazer o backfill sem bloqueio
DROP TRIGGER IF EXISTS tg_protect_profile_cols ON public.profiles;

-- 2. Backfill: profiles sem onboarding concluído voltam para aprovado=false
UPDATE public.profiles
SET aprovado = false
WHERE tipo_usuario IS NULL AND aprovado = true;

-- 3. Recriar function com a nova lógica
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_free boolean;
BEGIN
  is_free := NEW.tipo_usuario IS NOT NULL
    AND lower(coalesce(NEW.plano_pretendido, 'free')) IN ('free','gratis','grátis');

  IF is_free THEN
    NEW.aprovado := true;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.is_super_admin_safe() THEN
    IF (NEW.aprovado IS DISTINCT FROM OLD.aprovado AND NOT is_free)
       OR (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
       OR (NEW.pagamento_validado IS DISTINCT FROM OLD.pagamento_validado) THEN
      RAISE EXCEPTION 'Alteracao de coluna privilegiada do perfil nao autorizada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Recriar trigger
CREATE TRIGGER tg_protect_profile_cols
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_cols();
