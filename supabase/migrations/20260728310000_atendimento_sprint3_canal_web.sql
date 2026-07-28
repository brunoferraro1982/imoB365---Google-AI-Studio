-- Central de Atendimento — Sprint 3 (Canal Web)
-- RPCs públicas (SECURITY DEFINER) para abrir e acompanhar um chamado sem
-- precisar de sessão autenticada — mesmo padrão de public_create_tenant_lead/
-- public_create_lead, generalizado: o tenant é inferido do contexto
-- (imóvel/corretor) em vez de vir de um slug fixo.

CREATE OR REPLACE FUNCTION public.public_create_chamado(
  _nome text,
  _email text,
  _telefone text,
  _mensagem text,
  _categoria text DEFAULT 'outro',
  _imovel_id uuid DEFAULT NULL,
  _corretor_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant uuid;
  _responsavel chamado_responsavel_tipo := 'imob365';
  _solicitante_tipo chamado_solicitante_tipo := 'anonimo';
  _user_id uuid := auth.uid();
  _chamado_id uuid;
  _numero text;
BEGIN
  IF length(coalesce(_nome,'')) < 2 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF length(coalesce(_nome,'')) > 200 THEN RAISE EXCEPTION 'Nome muito longo'; END IF;
  IF length(coalesce(_mensagem,'')) < 5 THEN RAISE EXCEPTION 'Mensagem obrigatória'; END IF;
  IF coalesce(length(_email),0) > 255 OR coalesce(length(_telefone),0) > 40
     OR coalesce(length(_mensagem),0) > 2000 THEN
    RAISE EXCEPTION 'Campos excedem limite';
  END IF;

  -- Roteamento determinístico por contexto (não é match/adivinhação entre
  -- tenants candidatos): se veio de um imóvel ou corretor específico, o
  -- tenant já é conhecido e o chamado vai direto pro balcão daquele tenant.
  IF _imovel_id IS NOT NULL THEN
    SELECT tenant_id INTO _tenant FROM public.imoveis WHERE id = _imovel_id;
  ELSIF _corretor_slug IS NOT NULL THEN
    SELECT tenant_id INTO _tenant FROM public.corretores WHERE slug = _corretor_slug;
  END IF;

  IF _tenant IS NOT NULL THEN
    _responsavel := 'tenant';
    _solicitante_tipo := 'cliente_final';
  END IF;

  IF _user_id IS NOT NULL THEN
    IF _tenant IS NULL AND _categoria = 'problema_plataforma'
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
      -- Membro de tenant reportando problema da própria plataforma —
      -- sempre vai pro balcão imoB365, nunca é roteado a um tenant.
      _solicitante_tipo := 'tenant_member';
      SELECT tenant_id INTO _tenant FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    ELSIF _tenant IS NULL THEN
      _solicitante_tipo := 'cliente_final';
    END IF;
  END IF;

  INSERT INTO public.chamados (
    responsavel_tipo, tenant_id, solicitante_tipo, solicitante_user_id,
    solicitante_nome, solicitante_email, solicitante_telefone,
    categoria, canal_origem, contexto, assunto
  ) VALUES (
    _responsavel, _tenant, _solicitante_tipo, _user_id,
    _nome, nullif(_email,''), nullif(_telefone,''),
    _categoria::chamado_categoria, 'web_formulario',
    jsonb_strip_nulls(jsonb_build_object('imovel_id', _imovel_id, 'corretor_slug', _corretor_slug)),
    left(_mensagem, 120)
  )
  RETURNING id, numero INTO _chamado_id, _numero;

  INSERT INTO public.chamado_mensagens (chamado_id, autor_tipo, canal, conteudo)
  VALUES (_chamado_id, 'cliente', 'web_formulario', _mensagem);

  RETURN jsonb_build_object('id', _chamado_id, 'numero', _numero);
END;
$$;

REVOKE ALL ON FUNCTION public.public_create_chamado(text,text,text,text,text,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_create_chamado(text,text,text,text,text,uuid,text) TO anon, authenticated;

-- Acompanhamento sem login: casa por número + e-mail (mesmo princípio de
-- public_minhas_visitas), nunca expõe nota interna.
CREATE OR REPLACE FUNCTION public.public_buscar_chamado(_numero text, _email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _chamado record;
  _mensagens jsonb;
BEGIN
  SELECT * INTO _chamado FROM public.chamados
    WHERE numero = _numero AND lower(solicitante_email) = lower(_email);
  IF _chamado.id IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado. Confira o número e o e-mail informados.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'autor_tipo', autor_tipo, 'conteudo', conteudo, 'created_at', created_at
         ) ORDER BY created_at), '[]'::jsonb)
    INTO _mensagens
    FROM public.chamado_mensagens
    WHERE chamado_id = _chamado.id AND interno = false;

  RETURN jsonb_build_object(
    'numero', _chamado.numero, 'assunto', _chamado.assunto, 'status', _chamado.status,
    'prioridade', _chamado.prioridade, 'created_at', _chamado.created_at, 'mensagens', _mensagens
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_buscar_chamado(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_buscar_chamado(text,text) TO anon, authenticated;
