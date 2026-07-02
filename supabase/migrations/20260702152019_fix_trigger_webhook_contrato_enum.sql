-- Bug crítico: tg_webhook_contrato() comparava NEW.status (enum
-- contrato_status: rascunho|ativo|encerrado|cancelado) contra o literal
-- 'assinado', que não é um valor válido desse enum. Como a comparação é
-- avaliada/castada incondicionalmente, QUALQUER UPDATE na tabela contratos
-- falhava com "invalid input value for enum contrato_status: assinado" —
-- inclusive edições que não mexem no status. O estado de assinatura do
-- contrato vive em outra coluna (assinatura_status, texto livre, valores
-- rascunho|enviado|assinado_parcial|assinado_total), não em `status`.

CREATE OR REPLACE FUNCTION public.tg_webhook_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assinatura_status = 'assinado_total'
     AND OLD.assinatura_status IS DISTINCT FROM 'assinado_total' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'contrato.assinado', to_jsonb(NEW));
  END IF;
  IF NEW.status = 'ativo' AND OLD.status IS DISTINCT FROM 'ativo' THEN
    PERFORM public.enqueue_webhook(NEW.tenant_id, 'contrato.ativo', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;
