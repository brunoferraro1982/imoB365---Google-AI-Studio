
-- 1) Histórico de preço público (apenas imóveis publicados/ativos)
CREATE OR REPLACE FUNCTION public.public_historico_preco(_imovel_id uuid)
RETURNS TABLE(valor_anterior text, valor_novo text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.valor_anterior, h.valor_novo, h.created_at
  FROM public.imovel_historico h
  JOIN public.imoveis i ON i.id = h.imovel_id
  WHERE h.imovel_id = _imovel_id
    AND h.campo = 'preco'
    AND i.publicado = true
    AND i.status = 'ativo'
  ORDER BY h.created_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.public_historico_preco(uuid) TO anon, authenticated;

-- 2) Rate-limit em public_solicitar_visita
CREATE OR REPLACE FUNCTION public.public_solicitar_visita(
  _imovel_id uuid,
  _data_hora timestamptz,
  _nome text,
  _email text,
  _telefone text,
  _mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _corretor uuid;
  _lead_id uuid;
  _visita_id uuid;
  _recentes int;
BEGIN
  IF length(coalesce(_nome,'')) < 2 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF length(coalesce(_nome,'')) > 200 THEN RAISE EXCEPTION 'Nome muito longo'; END IF;
  IF coalesce(length(_email),0) > 255 OR coalesce(length(_telefone),0) > 40 OR coalesce(length(_mensagem),0) > 2000 THEN
    RAISE EXCEPTION 'Campos excedem limite';
  END IF;
  IF _data_hora < now() THEN RAISE EXCEPTION 'Data/hora inválida'; END IF;
  IF _data_hora > now() + interval '90 days' THEN RAISE EXCEPTION 'Data muito distante'; END IF;

  -- Rate-limit: máximo 3 visitas pendentes/agendadas nas últimas 24h pelo mesmo contato
  IF coalesce(_email,'') <> '' OR coalesce(_telefone,'') <> '' THEN
    SELECT count(*) INTO _recentes
    FROM public.visitas v
    WHERE v.created_at > now() - interval '24 hours'
      AND v.status IN ('agendada','confirmada')
      AND (
        (coalesce(_email,'') <> '' AND lower(v.visitante_email) = lower(_email))
        OR (coalesce(_telefone,'') <> '' AND regexp_replace(coalesce(v.visitante_telefone,''),'\D','','g') = regexp_replace(_telefone,'\D','','g'))
      );
    IF _recentes >= 3 THEN
      RAISE EXCEPTION 'Muitas solicitações recentes. Tente novamente em algumas horas.';
    END IF;
  END IF;

  SELECT tenant_id, corretor_responsavel_id INTO _tenant, _corretor
  FROM public.imoveis
  WHERE id = _imovel_id AND publicado = true AND status = 'ativo';

  IF _tenant IS NULL THEN RAISE EXCEPTION 'Imóvel não encontrado'; END IF;
  IF _corretor IS NULL THEN _corretor := public.assign_lead_round_robin(_tenant); END IF;

  INSERT INTO public.leads(tenant_id, imovel_id, corretor_id, nome, email, telefone, mensagem, origem, status)
  VALUES (_tenant, _imovel_id, _corretor, _nome,
          nullif(_email,''), nullif(_telefone,''),
          coalesce(nullif(_mensagem,''), 'Solicitação de visita pelo site'),
          'site', 'novo')
  RETURNING id INTO _lead_id;

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
