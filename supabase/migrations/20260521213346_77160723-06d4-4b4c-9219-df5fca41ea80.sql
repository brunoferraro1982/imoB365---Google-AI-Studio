
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  imovel_id uuid NOT NULL,
  interessado_user_id uuid NOT NULL,
  corretor_user_id uuid,
  assunto text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_sender_role text,
  unread_interessado integer NOT NULL DEFAULT 0,
  unread_corretor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_unique_thread UNIQUE (imovel_id, interessado_user_id)
);
CREATE INDEX chat_conversations_tenant_idx ON public.chat_conversations (tenant_id, last_message_at DESC);
CREATE INDEX chat_conversations_interessado_idx ON public.chat_conversations (interessado_user_id, last_message_at DESC);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conv_select ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY chat_conv_insert ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (interessado_user_id = auth.uid());

CREATE POLICY chat_conv_update ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), tenant_id))
  WITH CHECK (interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('interessado','corretor','system')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','quick_reply','system')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_idx ON public.chat_messages (conversation_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_msg_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (c.interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), c.tenant_id))
  ));

CREATE POLICY chat_msg_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), c.tenant_id))
    )
  );

CREATE POLICY chat_msg_update ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (c.interessado_user_id = auth.uid() OR public.is_member_of_tenant(auth.uid(), c.tenant_id))
  ));

CREATE TABLE public.chat_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  content text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_quick_replies_tenant_idx ON public.chat_quick_replies (tenant_id, ordem);

ALTER TABLE public.chat_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_qr_select ON public.chat_quick_replies
  FOR SELECT TO authenticated
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY chat_qr_admin ON public.chat_quick_replies
  FOR ALL TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TRIGGER chat_conversations_set_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

INSERT INTO public.chat_quick_replies (tenant_id, label, content, ordem)
SELECT t.id, q.label, q.content, q.ordem
FROM public.tenants t
CROSS JOIN (VALUES
  ('Disponível', 'Sim, ainda está disponível.', 1),
  ('Qual sua oferta?', 'Qual é a sua oferta?', 2),
  ('Não aceito oferta', 'Desculpe, não aceito oferta.', 3),
  ('Já vendi', 'Desculpe, já vendi.', 4)
) AS q(label, content, ordem);
