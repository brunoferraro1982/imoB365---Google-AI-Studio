-- Fix: trigger tg_webhook_lead referencia 'convertido' que não existe no enum lead_status
-- O enum possui: novo, contato, visita, proposta, ganho, perdido
-- 'convertido' corresponde semanticamente a 'ganho'

CREATE OR REPLACE FUNCTION public.tg_webhook_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.created', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
      PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.atribuido', to_jsonb(NEW));
    END IF;
    IF NEW.status = 'ganho' AND OLD.status IS DISTINCT FROM 'ganho' THEN
      PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.convertido', to_jsonb(NEW));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
