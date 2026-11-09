-- Funis de verdade e lead scoring de verdade.
-- 1) Etapas do funil têm categoria (novo, contato, visita, proposta, ganho, perdido),
--    que é a mesma do leads.status. Mover o lead mantém etapa e status sincronizados.
-- 2) Score = histórico de eventos (lead_score_eventos) somado em leads.score.

-- =========================================================================
-- 1. Categoria das etapas
-- =========================================================================
ALTER TABLE public.lead_funil_etapas ADD COLUMN IF NOT EXISTS categoria text;

UPDATE public.lead_funil_etapas e
   SET categoria = CASE
     WHEN e.is_ganho THEN 'ganho'
     WHEN e.is_perdido THEN 'perdido'
     WHEN e.ordem = (SELECT min(x.ordem) FROM public.lead_funil_etapas x WHERE x.funil_id = e.funil_id) THEN 'novo'
     ELSE 'contato'
   END
 WHERE e.categoria IS NULL;

ALTER TABLE public.lead_funil_etapas ALTER COLUMN categoria SET NOT NULL;
ALTER TABLE public.lead_funil_etapas DROP CONSTRAINT IF EXISTS lead_funil_etapas_categoria_check;
ALTER TABLE public.lead_funil_etapas ADD CONSTRAINT lead_funil_etapas_categoria_check
  CHECK (categoria IN ('novo','contato','visita','proposta','ganho','perdido'));

-- is_ganho / is_perdido passam a ser derivados da categoria.
CREATE OR REPLACE FUNCTION public.tg_lead_funil_etapa_derivados()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_ganho := (NEW.categoria = 'ganho');
  NEW.is_perdido := (NEW.categoria = 'perdido');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_lead_funil_etapa_derivados ON public.lead_funil_etapas;
CREATE TRIGGER tg_lead_funil_etapa_derivados BEFORE INSERT OR UPDATE OF categoria ON public.lead_funil_etapas
  FOR EACH ROW EXECUTE FUNCTION public.tg_lead_funil_etapa_derivados();

-- Um funil padrão ativo por tenant.
UPDATE public.lead_funis f SET is_default = false
 WHERE f.is_default AND f.ativo
   AND f.id <> (SELECT g.id FROM public.lead_funis g WHERE g.tenant_id = f.tenant_id AND g.is_default AND g.ativo ORDER BY g.created_at, g.id LIMIT 1);
CREATE UNIQUE INDEX IF NOT EXISTS lead_funis_padrao_unico ON public.lead_funis (tenant_id) WHERE is_default AND ativo;

-- =========================================================================
-- 2. Regras de scoring: uma por evento por tenant
-- =========================================================================
DELETE FROM public.lead_scoring_regras a
 USING public.lead_scoring_regras b
 WHERE a.tenant_id = b.tenant_id AND a.evento = b.evento
   AND (a.created_at, a.id) > (b.created_at, b.id);
CREATE UNIQUE INDEX IF NOT EXISTS lead_scoring_regras_tenant_evento ON public.lead_scoring_regras (tenant_id, evento);

-- =========================================================================
-- 3. Funil padrão do tenant (criado sob demanda) e backfill dos leads
-- =========================================================================
CREATE OR REPLACE FUNCTION public.garantir_funil_padrao(_tenant uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fid uuid;
BEGIN
  SELECT id INTO fid FROM public.lead_funis WHERE tenant_id = _tenant AND is_default AND ativo LIMIT 1;
  IF fid IS NOT NULL THEN RETURN fid; END IF;

  INSERT INTO public.lead_funis (tenant_id, nome, is_default, ativo)
  VALUES (_tenant, 'Funil de vendas', true, true)
  RETURNING id INTO fid;

  INSERT INTO public.lead_funil_etapas (tenant_id, funil_id, nome, ordem, cor, categoria) VALUES
    (_tenant, fid, 'Novos', 1, '#0ea5e9', 'novo'),
    (_tenant, fid, 'Em contato', 2, '#f59e0b', 'contato'),
    (_tenant, fid, 'Visita', 3, '#6366f1', 'visita'),
    (_tenant, fid, 'Proposta', 4, '#a855f7', 'proposta'),
    (_tenant, fid, 'Ganho', 5, '#10b981', 'ganho'),
    (_tenant, fid, 'Perdido', 6, '#f43f5e', 'perdido');
  RETURN fid;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.garantir_funil_padrao(t.id);
  END LOOP;
END $$;

UPDATE public.leads l
   SET funil_id = f.id
  FROM public.lead_funis f
 WHERE f.tenant_id = l.tenant_id AND f.is_default AND f.ativo AND l.funil_id IS NULL;

UPDATE public.leads l
   SET etapa_id = (
     SELECT e.id FROM public.lead_funil_etapas e
      WHERE e.funil_id = l.funil_id AND e.categoria = l.status::text
      ORDER BY e.ordem LIMIT 1)
 WHERE l.etapa_id IS NULL AND l.funil_id IS NOT NULL;

-- =========================================================================
-- 4. Triggers em leads: etapa e status sempre coerentes
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_leads_funil_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cat text;
BEGIN
  IF NEW.funil_id IS NULL THEN
    NEW.funil_id := public.garantir_funil_padrao(NEW.tenant_id);
  END IF;
  IF NEW.etapa_id IS NOT NULL THEN
    SELECT categoria INTO cat FROM public.lead_funil_etapas WHERE id = NEW.etapa_id;
  ELSE
    SELECT e.id, e.categoria INTO NEW.etapa_id, cat
      FROM public.lead_funil_etapas e
     WHERE e.funil_id = NEW.funil_id AND e.categoria = NEW.status::text
     ORDER BY e.ordem LIMIT 1;
  END IF;
  IF cat IS NOT NULL THEN
    NEW.status := cat::lead_status;
  END IF;
  IF NEW.status = 'ganho' THEN NEW.ganho_em := now(); END IF;
  IF NEW.status = 'perdido' THEN NEW.perdido_em := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_leads_funil_insert ON public.leads;
CREATE TRIGGER tg_leads_funil_insert BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_leads_funil_insert();

CREATE OR REPLACE FUNCTION public.tg_leads_funil_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cat text;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id AND NEW.etapa_id IS NOT NULL THEN
    -- moveu de etapa: status segue a categoria da nova etapa
    SELECT funil_id, categoria INTO NEW.funil_id, cat FROM public.lead_funil_etapas WHERE id = NEW.etapa_id;
    NEW.status := cat::lead_status;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- mudou só o status (ficha, captação): leva para a primeira etapa dessa categoria no funil atual
    SELECT e.id INTO NEW.etapa_id
      FROM public.lead_funil_etapas e
     WHERE e.funil_id = COALESCE(NEW.funil_id, public.garantir_funil_padrao(NEW.tenant_id))
       AND e.categoria = NEW.status::text
     ORDER BY e.ordem LIMIT 1;
    NEW.funil_id := COALESCE(NEW.funil_id, public.garantir_funil_padrao(NEW.tenant_id));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ganho' THEN NEW.ganho_em := now(); END IF;
    IF NEW.status = 'perdido' THEN NEW.perdido_em := now(); END IF;
    IF OLD.status = 'ganho' AND NEW.status <> 'ganho' THEN NEW.ganho_em := NULL; END IF;
    IF OLD.status = 'perdido' AND NEW.status <> 'perdido' THEN NEW.perdido_em := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_leads_funil_update ON public.leads;
CREATE TRIGGER tg_leads_funil_update BEFORE UPDATE OF etapa_id, status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_leads_funil_update();

-- =========================================================================
-- 5. Score: histórico de eventos somado em leads.score
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.lead_score_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  evento text NOT NULL,
  pontos integer NOT NULL,
  ref text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, evento, ref)
);
CREATE INDEX IF NOT EXISTS lead_score_eventos_lead_idx ON public.lead_score_eventos (lead_id);
ALTER TABLE public.lead_score_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lse_read ON public.lead_score_eventos;
CREATE POLICY lse_read ON public.lead_score_eventos FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));
GRANT SELECT ON public.lead_score_eventos TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_evento_lead(_lead uuid, _evento text, _ref text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid;
  p integer;
BEGIN
  SELECT tenant_id INTO t FROM public.leads WHERE id = _lead;
  IF t IS NULL THEN RETURN; END IF;
  SELECT pontos INTO p FROM public.lead_scoring_regras
   WHERE tenant_id = t AND evento = _evento AND ativo LIMIT 1;
  IF p IS NULL THEN RETURN; END IF;
  INSERT INTO public.lead_score_eventos (tenant_id, lead_id, evento, pontos, ref)
  VALUES (t, _lead, _evento, p, COALESCE(_ref, ''))
  ON CONFLICT (lead_id, evento, ref) DO NOTHING;
  IF FOUND THEN
    UPDATE public.leads SET score = COALESCE(score, 0) + p WHERE id = _lead;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_score_lead_criado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.registrar_evento_lead(NEW.id, 'lead.criado', '');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_score_lead_criado ON public.leads;
CREATE TRIGGER tg_score_lead_criado AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_lead_criado();

CREATE OR REPLACE FUNCTION public.tg_score_lead_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'contato' THEN
    PERFORM public.registrar_evento_lead(NEW.id, 'lead.contatado', '');
  ELSIF NEW.status = 'proposta' THEN
    PERFORM public.registrar_evento_lead(NEW.id, 'lead.proposta', '');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_score_lead_status ON public.leads;
CREATE TRIGGER tg_score_lead_status AFTER UPDATE OF status ON public.leads
  FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.tg_score_lead_status();

CREATE OR REPLACE FUNCTION public.tg_score_visita()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento_lead(NEW.lead_id, 'lead.visita_marcada', NEW.id::text);
  ELSIF NEW.status = 'realizada' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.registrar_evento_lead(NEW.lead_id, 'lead.visita_realizada', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_score_visita_insert ON public.visitas;
CREATE TRIGGER tg_score_visita_insert AFTER INSERT ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_visita();
DROP TRIGGER IF EXISTS tg_score_visita_update ON public.visitas;
CREATE TRIGGER tg_score_visita_update AFTER UPDATE OF status ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_visita();

-- Recálculo: refaz os eventos a partir dos dados atuais com as regras vigentes.
CREATE OR REPLACE FUNCTION public._recalcular_scores(_tenant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer := 0;
  r record;
BEGIN
  DELETE FROM public.lead_score_eventos WHERE tenant_id = _tenant;
  UPDATE public.leads SET score = 0 WHERE tenant_id = _tenant;
  FOR r IN SELECT id, status FROM public.leads WHERE tenant_id = _tenant LOOP
    n := n + 1;
    PERFORM public.registrar_evento_lead(r.id, 'lead.criado', '');
    IF r.status IN ('contato','visita','proposta','ganho') THEN
      PERFORM public.registrar_evento_lead(r.id, 'lead.contatado', '');
    END IF;
    IF r.status IN ('proposta','ganho') THEN
      PERFORM public.registrar_evento_lead(r.id, 'lead.proposta', '');
    END IF;
  END LOOP;
  FOR r IN SELECT v.id, v.lead_id, v.status FROM public.visitas v
            WHERE v.tenant_id = _tenant AND v.lead_id IS NOT NULL
              AND v.status <> 'cancelada' LOOP
    PERFORM public.registrar_evento_lead(r.lead_id, 'lead.visita_marcada', r.id::text);
    IF r.status = 'realizada' THEN
      PERFORM public.registrar_evento_lead(r.lead_id, 'lead.visita_realizada', r.id::text);
    END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.recalcular_scores_tenant(_tenant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), _tenant, 'admin'::app_role)
    OR public.has_role_in_tenant(auth.uid(), _tenant, 'broker'::app_role)
  ) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  RETURN public._recalcular_scores(_tenant);
END $$;
REVOKE EXECUTE ON FUNCTION public.recalcular_scores_tenant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalcular_scores_tenant(uuid) TO authenticated;

-- Backfill: calcula o score atual de todos os tenants com as regras vigentes.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public._recalcular_scores(t.id);
  END LOOP;
END $$;

-- =========================================================================
-- 6. Base de conhecimento do assistente (funis e scoring)
-- =========================================================================
UPDATE public.ai_knowledge_base
   SET conteudo = $kb$Os funis ficam em Leads > Funis (/app/leads/funis). Cada etapa tem uma categoria (novo, contato, visita, proposta, ganho ou perdido). Ao arrastar um lead de uma etapa para outra no kanban, a etapa e o status mudam juntos. As regras de pontuação ficam em Leads > Pontuação (/app/leads/pontuacao): cada evento com fonte (lead criado, lead contatado, visita marcada, visita realizada e proposta) vale os pontos da regra. O score de cada lead é a soma desses eventos e aparece no card do kanban e na ficha. Recalcular refaz a pontuação com as regras atuais.$kb$,
       perguntas = ARRAY[$kb$como configurar o lead scoring$kb$,$kb$como dar pontos para os leads$kb$,$kb$como priorizar leads quentes$kb$,$kb$onde crio regras de score$kb$,$kb$como funciona o funil de leads$kb$,$kb$onde configuro as etapas do kanban$kb$]::text[],
       updated_at = now()
 WHERE titulo = 'Como configurar o lead scoring (pontuação de leads)';
