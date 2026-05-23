
CREATE OR REPLACE FUNCTION public.tg_lead_notifica_corretor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_nome text;
  v_tenant_nome text;
  v_html text;
  v_subject text;
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
    v_subject := 'Novo lead: ' || NEW.nome;
    v_html := format(
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">' ||
      '<h2 style="margin:0 0 12px">Olá, %s!</h2>' ||
      '<p style="color:#555;margin:0 0 16px">Você recebeu um novo lead em <strong>%s</strong>.</p>' ||
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0">' ||
      '<p style="margin:0 0 6px"><strong>Nome:</strong> %s</p>' ||
      '<p style="margin:0 0 6px"><strong>E-mail:</strong> %s</p>' ||
      '<p style="margin:0 0 6px"><strong>Telefone:</strong> %s</p>' ||
      '<p style="margin:12px 0 0;white-space:pre-wrap"><strong>Mensagem:</strong><br>%s</p>' ||
      '</div>' ||
      '<p style="font-size:12px;color:#888;margin:24px 0 0">imob365</p>' ||
      '</div>',
      COALESCE(v_nome, 'corretor'),
      COALESCE(v_tenant_nome, 'sua imobiliária'),
      NEW.nome,
      COALESCE(NEW.email, '—'),
      COALESCE(NEW.telefone, '—'),
      COALESCE(NEW.mensagem, '—')
    );

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'to', v_email,
      'subject', v_subject,
      'html', v_html,
      'label', 'novo_lead',
      'sender_domain', 'notify.imob365.com.br',
      'from', 'imob365 <no-reply@notify.imob365.com.br>',
      'purpose', 'transactional',
      'message_id', gen_random_uuid()::text
    ));
  END IF;

  RETURN NEW;
END;
$$;
