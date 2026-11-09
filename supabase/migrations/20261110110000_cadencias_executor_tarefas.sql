-- Cadências: aplicar a um lead gera tarefas (lead_cadencia_jobs) com prazo cumulativo.
-- O corretor conclui cada tarefa na ficha do lead. Envio automático ainda não existe.
-- Aplicação automática: cadência com trigger_etapa_id = etapa para a qual o lead foi movido.
-- Quando o lead virar ganho ou perdido, as tarefas pendentes são canceladas.

-- Uma tarefa por passo por lead (idempotente ao reaplicar)
DELETE FROM public.lead_cadencia_jobs a
 USING public.lead_cadencia_jobs b
 WHERE a.lead_id = b.lead_id AND a.step_id = b.step_id AND a.created_at > b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS lead_cadencia_jobs_lead_step ON public.lead_cadencia_jobs (lead_id, step_id);

-- Núcleo: cria as tarefas (sem checagem de usuário; usado pelo gatilho e pela RPC)
CREATE OR REPLACE FUNCTION public._aplicar_cadencia_lead(_lead uuid, _cadencia uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid;
  n integer;
BEGIN
  SELECT tenant_id INTO t FROM public.leads WHERE id = _lead;
  IF t IS NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lead_cadencias WHERE id = _cadencia AND tenant_id = t AND ativo) THEN
    RETURN 0;
  END IF;

  WITH passos AS (
    SELECT s.id, s.tenant_id, s.cadencia_id,
           sum(s.delay_horas) OVER (ORDER BY s.ordem, s.created_at ROWS UNBOUNDED PRECEDING) AS acumulado
      FROM public.lead_cadencia_steps s
     WHERE s.cadencia_id = _cadencia AND s.tenant_id = t
  )
  INSERT INTO public.lead_cadencia_jobs (tenant_id, lead_id, cadencia_id, step_id, scheduled_at)
  SELECT p.tenant_id, _lead, p.cadencia_id, p.id, now() + make_interval(hours => p.acumulado::int)
    FROM passos p
  ON CONFLICT (lead_id, step_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- RPC chamada pela ficha do lead (corretor/admin do tenant)
CREATE OR REPLACE FUNCTION public.aplicar_cadencia_lead(_lead uuid, _cadencia uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid;
BEGIN
  SELECT tenant_id INTO t FROM public.leads WHERE id = _lead;
  IF t IS NULL OR NOT public.is_member_of_tenant(auth.uid(), t) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  RETURN public._aplicar_cadencia_lead(_lead, _cadencia);
END $$;
REVOKE EXECUTE ON FUNCTION public.aplicar_cadencia_lead(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aplicar_cadencia_lead(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.concluir_tarefa_cadencia(_job uuid, _resultado text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid;
BEGIN
  SELECT tenant_id INTO t FROM public.lead_cadencia_jobs WHERE id = _job;
  IF t IS NULL OR NOT public.is_member_of_tenant(auth.uid(), t) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  UPDATE public.lead_cadencia_jobs
     SET status = 'concluido', executed_at = now(), resultado = NULLIF(trim(COALESCE(_resultado, '')), '')
   WHERE id = _job AND status = 'pendente';
END $$;
REVOKE EXECUTE ON FUNCTION public.concluir_tarefa_cadencia(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.concluir_tarefa_cadencia(uuid, text) TO authenticated;

-- Gatilhos em leads
CREATE OR REPLACE FUNCTION public.tg_leads_cadencia_etapa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id AND NEW.etapa_id IS NOT NULL THEN
    FOR c IN SELECT id FROM public.lead_cadencias
              WHERE tenant_id = NEW.tenant_id AND ativo AND trigger_etapa_id = NEW.etapa_id LOOP
      PERFORM public._aplicar_cadencia_lead(NEW.id, c.id);
    END LOOP;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('ganho','perdido') THEN
    UPDATE public.lead_cadencia_jobs SET status = 'cancelado', executed_at = now()
     WHERE lead_id = NEW.id AND status = 'pendente';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_leads_cadencia_etapa ON public.leads;
CREATE TRIGGER tg_leads_cadencia_etapa AFTER UPDATE OF etapa_id, status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_leads_cadencia_etapa();

-- Base de conhecimento: texto correto sobre cadências
UPDATE public.ai_knowledge_base
   SET conteudo = $kb$As cadências ficam em Leads > Cadências (/app/leads/cadencias). Cada cadência tem passos com canal (WhatsApp, e-mail ou ligação), atraso em horas após o passo anterior e um texto com {{nome}}. Aplicar a cadência a um lead cria tarefas na ficha do lead, com o texto pronto. O WhatsApp abre a conversa já preenchida; o e-mail e a ligação são feitos pelo corretor, que marca a tarefa como concluída. O envio automático ainda não existe. Se a cadência tiver uma etapa de disparo, ela é aplicada sozinha quando o lead entra nessa etapa. Quando o lead for ganho ou perdido, as tarefas pendentes são canceladas.$kb$,
       perguntas = ARRAY[$kb$como criar cadências de follow-up$kb$,$kb$como configurar cadências$kb$,$kb$cadência envia mensagem automaticamente$kb$,$kb$como aplicar cadência a um lead$kb$]::text[],
       updated_at = now()
 WHERE titulo = 'Como criar cadências de follow-up';
