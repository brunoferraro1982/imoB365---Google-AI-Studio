
-- 1) Novos campos
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS visitante_nome text,
  ADD COLUMN IF NOT EXISTS visitante_email text,
  ADD COLUMN IF NOT EXISTS visitante_telefone text,
  ADD COLUMN IF NOT EXISTS lembrete_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS nps_enviado_at timestamptz;

-- 2) RPC público: solicitar visita
CREATE OR REPLACE FUNCTION public.public_solicitar_visita(
  _imovel_id uuid,
  _data_hora timestamptz,
  _nome text,
  _email text,
  _telefone text,
  _mensagem text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant uuid;
  _corretor uuid;
  _lead_id uuid;
  _visita_id uuid;
BEGIN
  IF length(coalesce(_nome,'')) < 2 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF length(coalesce(_nome,'')) > 200 THEN RAISE EXCEPTION 'Nome muito longo'; END IF;
  IF coalesce(length(_email),0) > 255 OR coalesce(length(_telefone),0) > 40 OR coalesce(length(_mensagem),0) > 2000 THEN
    RAISE EXCEPTION 'Campos excedem limite';
  END IF;
  IF _data_hora < now() THEN RAISE EXCEPTION 'Data/hora inválida'; END IF;
  IF _data_hora > now() + interval '90 days' THEN RAISE EXCEPTION 'Data muito distante'; END IF;

  SELECT tenant_id, corretor_responsavel_id INTO _tenant, _corretor
  FROM public.imoveis
  WHERE id = _imovel_id AND publicado = true AND status = 'ativo';

  IF _tenant IS NULL THEN RAISE EXCEPTION 'Imóvel não encontrado'; END IF;
  IF _corretor IS NULL THEN _corretor := public.assign_lead_round_robin(_tenant); END IF;

  -- cria lead
  INSERT INTO public.leads(tenant_id, imovel_id, corretor_id, nome, email, telefone, mensagem, origem, status)
  VALUES (_tenant, _imovel_id, _corretor, _nome,
          nullif(_email,''), nullif(_telefone,''),
          coalesce(nullif(_mensagem,''), 'Solicitação de visita pelo site'),
          'site', 'novo')
  RETURNING id INTO _lead_id;

  -- cria visita
  INSERT INTO public.visitas(
    tenant_id, imovel_id, lead_id, corretor_id, data_hora, status,
    visitante_nome, visitante_email, visitante_telefone, observacoes
  ) VALUES (
    _tenant, _imovel_id, _lead_id, _corretor, _data_hora, 'agendada',
    _nome, nullif(_email,''), nullif(_telefone,''), nullif(_mensagem,'')
  ) RETURNING id INTO _visita_id;

  RETURN _visita_id;
END;
$$;

-- 3) Cron: chama o endpoint a cada 30 min
DO $$
DECLARE _anon_key text;
BEGIN
  -- remove jobs antigos com o mesmo nome
  BEGIN PERFORM cron.unschedule('processar-notificacoes-visitas'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

SELECT cron.schedule(
  'processar-notificacoes-visitas',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--e7dbc678-9151-4590-925f-3c3929336975.lovable.app/api/public/cron/visitas-notificacoes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdWx1emVobGx0dnF0d21jYmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDU3MTMsImV4cCI6MjA5NDkyMTcxM30.uyb4JdOu5U1j_mNYzqw0uHg5UXwlMy9HwaKy5d_-G60'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
