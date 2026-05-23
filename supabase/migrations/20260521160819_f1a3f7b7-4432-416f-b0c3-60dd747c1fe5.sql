
-- ============ WEBHOOK DELIVERIES (allow worker writes) ============
CREATE POLICY "service role manages deliveries" ON public.webhook_deliveries
  FOR ALL TO public USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============ enqueue_webhook ============
CREATE OR REPLACE FUNCTION public.enqueue_webhook(_tenant_id uuid, _evento text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.webhook_deliveries (webhook_id, tenant_id, evento, payload)
  SELECT w.id, w.tenant_id, _evento,
    jsonb_build_object('evento', _evento, 'tenant_id', _tenant_id, 'data', _payload, 'timestamp', now())
  FROM public.tenant_webhooks w
  WHERE w.tenant_id = _tenant_id AND w.ativo = true AND _evento = ANY(w.eventos);
END;
$$;

-- ============ LEAD events ============
CREATE OR REPLACE FUNCTION public.tg_webhook_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.created', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
      PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.atribuido', to_jsonb(NEW));
    END IF;
    IF NEW.status = 'convertido' AND OLD.status IS DISTINCT FROM 'convertido' THEN
      PERFORM public.enqueue_webhook(NEW.tenant_id, 'lead.convertido', to_jsonb(NEW));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_webhook_lead AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_lead();

-- ============ IMOVEL events ============
CREATE OR REPLACE FUNCTION public.tg_webhook_imovel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.publicado = true AND (OLD.publicado IS DISTINCT FROM true) THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'imovel.publicado', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_webhook_imovel AFTER UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_imovel();

-- ============ CONTRATO events ============
CREATE OR REPLACE FUNCTION public.tg_webhook_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'assinado' AND OLD.status IS DISTINCT FROM 'assinado' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'contrato.assinado', to_jsonb(NEW));
  END IF;
  IF NEW.status = 'ativo' AND OLD.status IS DISTINCT FROM 'ativo' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'contrato.ativo', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_webhook_contrato AFTER UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_contrato();

-- ============ AUDIT LOG ============
CREATE OR REPLACE FUNCTION public.tg_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant uuid;
  _entity_id text;
  _meta jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := (to_jsonb(OLD)->>'tenant_id')::uuid;
    _entity_id := (to_jsonb(OLD)->>'id');
    _meta := jsonb_build_object('old', to_jsonb(OLD));
  ELSE
    _tenant := (to_jsonb(NEW)->>'tenant_id')::uuid;
    _entity_id := (to_jsonb(NEW)->>'id');
    IF TG_OP = 'UPDATE' THEN
      _meta := jsonb_build_object('changes',
        (SELECT jsonb_object_agg(k, jsonb_build_object('old', to_jsonb(OLD)->k, 'new', to_jsonb(NEW)->k))
         FROM jsonb_object_keys(to_jsonb(NEW)) k
         WHERE to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k));
    ELSE
      _meta := '{}'::jsonb;
    END IF;
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity, entity_id, metadata)
  VALUES (_tenant, auth.uid(), lower(TG_OP), TG_TABLE_NAME, _entity_id, COALESCE(_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'imoveis','contratos','leads','comissoes','corretores',
    'lancamentos_financeiros','tenant_modules','tenant_domains','tenant_webhooks'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_audit_%I ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER tg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit();', t, t);
  END LOOP;
END $$;
