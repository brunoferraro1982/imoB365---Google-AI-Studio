
-- ============ 1) NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE lida_em IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user deletes own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "super admin all notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ 2) WEBHOOKS ============
CREATE TABLE public.tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  eventos text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_webhooks_tenant ON public.tenant_webhooks(tenant_id);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.tenant_webhooks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  evento text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  response_status int,
  response_body text,
  tentativas int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);

ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin tenant manage webhooks" ON public.tenant_webhooks
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "tenant read webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tg_tw_updated BEFORE UPDATE ON public.tenant_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 3) CUSTOM FIELDS ============
ALTER TABLE public.imoveis ADD COLUMN custom_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.tenant_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entidade text NOT NULL DEFAULT 'imovel',
  chave text NOT NULL,
  rotulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  opcoes text[] NOT NULL DEFAULT '{}',
  obrigatorio boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entidade, chave)
);
CREATE INDEX idx_tcf_tenant ON public.tenant_custom_fields(tenant_id, entidade, ordem);

ALTER TABLE public.tenant_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read custom fields" ON public.tenant_custom_fields
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin manage custom fields" ON public.tenant_custom_fields
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tg_tcf_updated BEFORE UPDATE ON public.tenant_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 4) TENANT DOMAINS ============
CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dominio text NOT NULL UNIQUE,
  verificado boolean NOT NULL DEFAULT false,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  primario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_domains_tenant ON public.tenant_domains(tenant_id);

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads verified domains" ON public.tenant_domains
  FOR SELECT TO anon, authenticated USING (verificado = true);
CREATE POLICY "admin manage domains" ON public.tenant_domains
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tg_td_updated BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 5) TRIGGER: novo lead → notifica corretor ============
CREATE OR REPLACE FUNCTION public.tg_lead_notifica_corretor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_nome text;
  v_tenant_nome text;
BEGIN
  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id, email, nome INTO v_user_id, v_email, v_nome
  FROM public.corretores WHERE id = NEW.corretor_id;

  SELECT nome INTO v_tenant_nome FROM public.tenants WHERE id = NEW.tenant_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (tenant_id, user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (
      NEW.tenant_id, v_user_id, 'lead.novo',
      'Novo lead: ' || NEW.nome,
      COALESCE(NEW.mensagem, 'Você recebeu um novo lead.'),
      '/app/leads/' || NEW.id::text,
      jsonb_build_object('lead_id', NEW.id, 'origem', NEW.origem)
    );
  END IF;

  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'template_name', 'novo_lead',
      'to', v_email,
      'subject', 'Novo lead: ' || NEW.nome,
      'data', jsonb_build_object(
        'corretor_nome', v_nome,
        'lead_nome', NEW.nome,
        'lead_email', NEW.email,
        'lead_telefone', NEW.telefone,
        'lead_mensagem', NEW.mensagem,
        'tenant_nome', v_tenant_nome,
        'link', '/app/leads/' || NEW.id::text
      )
    ));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_lead_notifica_corretor
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_lead_notifica_corretor();
