
-- 1) Dark mode preference + watermark settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tema_preferido text NOT NULL DEFAULT 'system';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS watermark jsonb NOT NULL DEFAULT '{"enabled":false,"texto":"","opacidade":0.4,"posicao":"se"}'::jsonb;

-- 2) Selos visuais nos imóveis
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS selos text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS preco_anterior numeric(14,2);

CREATE OR REPLACE FUNCTION public.imoveis_atualizar_selos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _selos text[] := '{}';
BEGIN
  IF NEW.publicado_em IS NOT NULL AND NEW.publicado_em > now() - interval '14 days' THEN
    _selos := array_append(_selos, 'novo');
  END IF;
  IF NEW.preco_anterior IS NOT NULL AND NEW.preco < NEW.preco_anterior THEN
    _selos := array_append(_selos, 'abaixou_preco');
  END IF;
  IF NEW.destaque IS TRUE THEN
    _selos := array_append(_selos, 'destaque');
  END IF;
  NEW.selos := _selos;
  RETURN NEW;
END $$;

-- detect "preco anterior"
CREATE OR REPLACE FUNCTION public.imoveis_track_preco_anterior()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.preco IS DISTINCT FROM OLD.preco THEN
    NEW.preco_anterior := OLD.preco;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_imoveis_track_preco ON public.imoveis;
CREATE TRIGGER tg_imoveis_track_preco BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.imoveis_track_preco_anterior();

DROP TRIGGER IF EXISTS tg_imoveis_selos ON public.imoveis;
CREATE TRIGGER tg_imoveis_selos BEFORE INSERT OR UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.imoveis_atualizar_selos();

-- 3) Visitas: NPS + check-in QR
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS checkin_token text UNIQUE;
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS checkin_at timestamptz;
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS nps_score smallint CHECK (nps_score BETWEEN 0 AND 10);
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS nps_comentario text;
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS nps_respondido_at timestamptz;

CREATE OR REPLACE FUNCTION public.visitas_set_checkin_token()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.checkin_token IS NULL THEN
    NEW.checkin_token := encode(gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_visitas_token ON public.visitas;
CREATE TRIGGER tg_visitas_token BEFORE INSERT ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.visitas_set_checkin_token();

CREATE OR REPLACE FUNCTION public.public_visita_checkin(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _v RECORD;
BEGIN
  SELECT v.id, v.tenant_id, v.imovel_id, i.titulo INTO _v
  FROM public.visitas v JOIN public.imoveis i ON i.id = v.imovel_id
  WHERE v.checkin_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido'; END IF;
  UPDATE public.visitas SET checkin_at = COALESCE(checkin_at, now()), status = 'realizada' WHERE id = _v.id;
  RETURN jsonb_build_object('visita_id', _v.id, 'imovel', _v.titulo);
END $$;

CREATE OR REPLACE FUNCTION public.public_visita_nps(_token text, _score smallint, _comentario text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _score < 0 OR _score > 10 THEN RAISE EXCEPTION 'Score inválido'; END IF;
  UPDATE public.visitas
    SET nps_score = _score, nps_comentario = nullif(_comentario,''), nps_respondido_at = now()
    WHERE checkin_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Token inválido'; END IF;
END $$;

-- 4) Snapshot diário (garantir unique)
CREATE UNIQUE INDEX IF NOT EXISTS tenant_usage_snapshots_tenant_date_uq
  ON public.tenant_usage_snapshots (tenant_id, snapshot_date);

CREATE OR REPLACE FUNCTION public.cron_snapshot_tenant_usage()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _n int := 0;
BEGIN
  INSERT INTO public.tenant_usage_snapshots (tenant_id, snapshot_date, imoveis_count, leads_count, usuarios_count, contratos_ativos)
  SELECT
    t.id,
    CURRENT_DATE,
    (SELECT count(*) FROM public.imoveis WHERE tenant_id = t.id),
    (SELECT count(*) FROM public.leads WHERE tenant_id = t.id),
    (SELECT count(*) FROM public.user_roles WHERE tenant_id = t.id),
    (SELECT count(*) FROM public.contratos WHERE tenant_id = t.id AND status = 'ativo')
  FROM public.tenants t
  ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
    imoveis_count = EXCLUDED.imoveis_count,
    leads_count = EXCLUDED.leads_count,
    usuarios_count = EXCLUDED.usuarios_count,
    contratos_ativos = EXCLUDED.contratos_ativos;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 5) Match -> notifica corretor (alerta)
CREATE OR REPLACE FUNCTION public.tg_lead_match_notifica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user_id uuid; _corretor uuid;
BEGIN
  IF NEW.score < 80 THEN RETURN NEW; END IF;
  SELECT corretor_id INTO _corretor FROM public.leads WHERE id = NEW.lead_id;
  IF _corretor IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO _user_id FROM public.corretores WHERE id = _corretor;
  IF _user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (tenant_id, user_id, tipo, titulo, mensagem, link, metadata)
  VALUES (NEW.tenant_id, _user_id, 'match.alto',
    'Novo match para lead',
    'Imóvel compatível encontrado (score ' || NEW.score || ').',
    '/app/leads/' || NEW.lead_id::text,
    jsonb_build_object('lead_id', NEW.lead_id, 'imovel_id', NEW.imovel_id, 'score', NEW.score));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_lead_match_notif ON public.lead_imovel_matches;
CREATE TRIGGER tg_lead_match_notif AFTER INSERT ON public.lead_imovel_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_lead_match_notifica();

-- 6) Checklist documental por etapa de venda
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'venda',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_read ON public.checklist_templates FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY ct_admin ON public.checklist_templates TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.checklist_template_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  etapa text NOT NULL,
  titulo text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true
);
ALTER TABLE public.checklist_template_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY cti_read ON public.checklist_template_itens FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY cti_admin ON public.checklist_template_itens TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.contrato_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  titulo text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  concluido boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  concluido_por uuid,
  observacoes text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contrato_checklist_contrato_idx ON public.contrato_checklist(contrato_id);
ALTER TABLE public.contrato_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_read ON public.contrato_checklist FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY cc_write ON public.contrato_checklist TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));

-- 7) Plano de contas + Centros de custo
CREATE TABLE IF NOT EXISTS public.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  parent_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, codigo)
);
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_read ON public.plano_contas FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY pc_admin ON public.plano_contas TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, codigo)
);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc2_read ON public.centros_custo FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY cc2_admin ON public.centros_custo TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

-- 8) Realtime para espelho de vendas
ALTER PUBLICATION supabase_realtime ADD TABLE public.empreendimento_unidades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.empreendimento_reservas;
