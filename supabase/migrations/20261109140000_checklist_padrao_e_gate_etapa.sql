-- Checklist do contrato: modelo padrão por tipo + gate de avanço por etapa.

-- 1) Um modelo pode ser o padrão (aplicado automaticamente) do seu tipo.
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS padrao boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS checklist_templates_padrao_unico
  ON public.checklist_templates (tenant_id, tipo)
  WHERE padrao AND ativo;

-- 2) Define o padrão do tipo de forma atômica (desmarca o anterior).
CREATE OR REPLACE FUNCTION public.definir_checklist_padrao(_template uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.checklist_templates%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.checklist_templates WHERE id = _template;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODELO_NAO_ENCONTRADO';
  END IF;
  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role_in_tenant(auth.uid(), t.tenant_id, 'admin'::app_role)
    OR has_role_in_tenant(auth.uid(), t.tenant_id, 'juridico'::app_role)
  ) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF NOT t.ativo THEN
    RAISE EXCEPTION 'MODELO_INATIVO';
  END IF;
  UPDATE public.checklist_templates SET padrao = false
    WHERE tenant_id = t.tenant_id AND tipo = t.tipo AND padrao AND id <> _template;
  UPDATE public.checklist_templates SET padrao = true WHERE id = _template;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.definir_checklist_padrao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.definir_checklist_padrao(uuid) TO authenticated;

-- 3) Gate no banco: não avança de etapa com obrigatório pendente na etapa atual.
-- Voltar ou ficar na mesma etapa não é bloqueado.
CREATE OR REPLACE FUNCTION public.tg_contrato_gate_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem text[] := ARRAY['captacao','analise','documentacao','juridico','assinatura',
                        'ativacao','financeiro','administracao','encerramento'];
  i_old int;
  i_new int;
  pend int;
BEGIN
  IF NEW.etapa_atual IS NOT DISTINCT FROM OLD.etapa_atual THEN
    RETURN NEW;
  END IF;
  i_old := array_position(ordem, OLD.etapa_atual);
  i_new := array_position(ordem, NEW.etapa_atual);
  IF i_old IS NULL OR i_new IS NULL OR i_new <= i_old THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO pend
    FROM public.contrato_checklist
   WHERE contrato_id = OLD.id AND etapa = OLD.etapa_atual AND obrigatorio AND NOT concluido;
  IF pend > 0 THEN
    RAISE EXCEPTION 'CHECKLIST_PENDENTE: % item(ns) obrigatório(s) pendente(s) na etapa %', pend, OLD.etapa_atual
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_contrato_gate_checklist ON public.contratos;
CREATE TRIGGER tg_contrato_gate_checklist
  BEFORE UPDATE OF etapa_atual ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_contrato_gate_checklist();
