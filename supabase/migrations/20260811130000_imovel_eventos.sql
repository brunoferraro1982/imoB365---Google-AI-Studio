-- Tracking first-party de desempenho de anúncio: visualizações e cliques no
-- WhatsApp por imóvel. Substitui os pseudo-dados de relatorios.functions.ts
-- (que eram derivados de titulo.length+idx+preço) por métricas reais.
-- Favoritos já vinham da tabela real `favoritos`, agregados aqui também.

CREATE TABLE IF NOT EXISTS public.imovel_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('view', 'whatsapp_click')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imovel_eventos_tenant_imovel_tipo
  ON public.imovel_eventos (tenant_id, imovel_id, tipo);

-- Deny-all: RLS habilitada e SEM policies de anon/authenticated. O acesso é
-- só pelas funções SECURITY DEFINER abaixo — dado de tráfego não é consultável
-- direto (nem escrito direto), evita scraping/adulteração das métricas.
ALTER TABLE public.imovel_eventos ENABLE ROW LEVEL SECURITY;

-- Registra um evento a partir da página pública do imóvel. Resolve o tenant
-- pelo próprio imóvel (ignora imóvel inexistente / tipo inválido). Mesmo padrão
-- de public_create_lead (SECURITY DEFINER, concedida a anon).
CREATE OR REPLACE FUNCTION public.public_record_imovel_evento(_imovel_id uuid, _tipo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF _tipo NOT IN ('view', 'whatsapp_click') THEN
    RETURN;
  END IF;
  SELECT tenant_id INTO v_tenant FROM public.imoveis WHERE id = _imovel_id;
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.imovel_eventos (imovel_id, tenant_id, tipo)
  VALUES (_imovel_id, v_tenant, _tipo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_record_imovel_evento(uuid, text) TO anon, authenticated;

-- Agrega métricas por imóvel do tenant do PRÓPRIO chamador (auth.uid()) —
-- sem parâmetro de tenant, zero risco cross-tenant. Usada por
-- relatorios.functions.ts (getRelatorios, JWT do usuário).
CREATE OR REPLACE FUNCTION public.relatorio_metricas_imoveis()
RETURNS TABLE (imovel_id uuid, views bigint, whatsapp_clicks bigint, favoritos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT p.tenant_id INTO v_tenant FROM public.profiles p WHERE p.id = auth.uid();
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    COALESCE(ev.views, 0)::bigint,
    COALESCE(ev.wa, 0)::bigint,
    COALESCE(fv.favoritos, 0)::bigint
  FROM public.imoveis i
  LEFT JOIN (
    SELECT
      e.imovel_id,
      count(*) FILTER (WHERE e.tipo = 'view') AS views,
      count(*) FILTER (WHERE e.tipo = 'whatsapp_click') AS wa
    FROM public.imovel_eventos e
    WHERE e.tenant_id = v_tenant
    GROUP BY e.imovel_id
  ) ev ON ev.imovel_id = i.id
  LEFT JOIN (
    SELECT f.imovel_id, count(*) AS favoritos
    FROM public.favoritos f
    JOIN public.imoveis i2 ON i2.id = f.imovel_id
    WHERE i2.tenant_id = v_tenant
    GROUP BY f.imovel_id
  ) fv ON fv.imovel_id = i.id
  WHERE i.tenant_id = v_tenant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.relatorio_metricas_imoveis() TO authenticated;
