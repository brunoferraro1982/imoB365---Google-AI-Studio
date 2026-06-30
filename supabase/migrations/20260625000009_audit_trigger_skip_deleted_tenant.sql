-- Fix: ao excluir um tenant, triggers de auditoria em tabelas filhas
-- (tenant_modules, tenant_domains, etc.) disparam DELETE cascata e tentam
-- inserir em audit_log com o tenant_id que está sendo removido, violando FK.
-- Solução: skip o INSERT quando o tenant já não existe.

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

  -- Skip audit if tenant no longer exists (cascade delete scenario)
  IF _tenant IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity, entity_id, metadata)
  VALUES (_tenant, auth.uid(), lower(TG_OP), TG_TABLE_NAME, _entity_id, COALESCE(_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;
