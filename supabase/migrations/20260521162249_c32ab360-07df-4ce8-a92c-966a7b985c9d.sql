
CREATE TYPE visita_status AS ENUM ('agendada','confirmada','realizada','cancelada','nao_compareceu');

CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  imovel_id uuid NOT NULL,
  lead_id uuid,
  corretor_id uuid,
  data_hora timestamptz NOT NULL,
  duracao_min integer NOT NULL DEFAULT 30,
  status visita_status NOT NULL DEFAULT 'agendada',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitas_tenant_data ON public.visitas (tenant_id, data_hora);
CREATE INDEX idx_visitas_corretor ON public.visitas (corretor_id, data_hora);

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY visitas_members_read ON public.visitas
  FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY visitas_members_write ON public.visitas
  FOR ALL TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY visitas_super_admin_all ON public.visitas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_visitas_updated_at
  BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_visita_notifica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_imovel_titulo text;
BEGIN
  SELECT user_id INTO v_user_id FROM corretores WHERE id = NEW.corretor_id;
  SELECT titulo INTO v_imovel_titulo FROM imoveis WHERE id = NEW.imovel_id;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO notifications (tenant_id, user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (
      NEW.tenant_id, v_user_id, 'visita',
      CASE TG_OP WHEN 'INSERT' THEN 'Nova visita agendada' ELSE 'Visita atualizada' END,
      COALESCE(v_imovel_titulo, 'Imóvel') || ' em ' || to_char(NEW.data_hora AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      '/app/imoveis/' || NEW.imovel_id::text,
      jsonb_build_object('visita_id', NEW.id, 'imovel_id', NEW.imovel_id)
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_visita_notifica
  AFTER INSERT OR UPDATE OF data_hora, status ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.tg_visita_notifica();

CREATE TABLE public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  ativo boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_api_keys_hash ON public.tenant_api_keys (key_hash);
CREATE INDEX idx_api_keys_tenant ON public.tenant_api_keys (tenant_id);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_admin_all ON public.tenant_api_keys
  FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY,
  email_novo_lead boolean NOT NULL DEFAULT true,
  email_visita boolean NOT NULL DEFAULT true,
  email_contrato boolean NOT NULL DEFAULT true,
  email_comissao boolean NOT NULL DEFAULT true,
  inapp_novo_lead boolean NOT NULL DEFAULT true,
  inapp_visita boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_self ON public.notification_prefs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_prefs_super_admin ON public.notification_prefs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
