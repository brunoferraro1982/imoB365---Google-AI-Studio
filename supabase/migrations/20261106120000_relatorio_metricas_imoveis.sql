-- Métricas de performance dos anúncios (Relatórios → Performance & Desempenho).
-- A RPC existia só no banco de dev (criada manualmente), sem migration no repo:
-- em produção as estatísticas ficavam zeradas porque a função não existia.
-- Definição idêntica à do dev; apenas versionada.
CREATE OR REPLACE FUNCTION public.relatorio_metricas_imoveis()
 RETURNS TABLE(imovel_id uuid, views bigint, whatsapp_clicks bigint, favoritos bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tenant uuid;
BEGIN
  SELECT p.tenant_id INTO v_tenant FROM public.profiles p WHERE p.id = auth.uid();
  IF v_tenant IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT i.id, COALESCE(ev.views,0)::bigint, COALESCE(ev.wa,0)::bigint, COALESCE(fv.favoritos,0)::bigint
  FROM public.imoveis i
  LEFT JOIN (
    SELECT e.imovel_id,
      count(*) FILTER (WHERE e.tipo='view') AS views,
      count(*) FILTER (WHERE e.tipo='whatsapp_click') AS wa
    FROM public.imovel_eventos e WHERE e.tenant_id = v_tenant GROUP BY e.imovel_id
  ) ev ON ev.imovel_id = i.id
  LEFT JOIN (
    SELECT f.imovel_id, count(*) AS favoritos
    FROM public.favoritos f JOIN public.imoveis i2 ON i2.id = f.imovel_id
    WHERE i2.tenant_id = v_tenant GROUP BY f.imovel_id
  ) fv ON fv.imovel_id = i.id
  WHERE i.tenant_id = v_tenant;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.relatorio_metricas_imoveis() FROM anon;
GRANT EXECUTE ON FUNCTION public.relatorio_metricas_imoveis() TO authenticated, service_role;
