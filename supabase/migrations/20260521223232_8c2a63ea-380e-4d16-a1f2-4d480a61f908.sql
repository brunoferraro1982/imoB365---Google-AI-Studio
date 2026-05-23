
CREATE OR REPLACE FUNCTION public.public_minhas_visitas()
RETURNS TABLE(
  id uuid,
  data_hora timestamptz,
  status visita_status,
  visitante_nome text,
  visitante_telefone text,
  observacoes text,
  checkin_token text,
  nps_score smallint,
  imovel_id uuid,
  imovel_titulo text,
  imovel_slug text,
  imovel_endereco text,
  tenant_nome text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    v.id, v.data_hora, v.status,
    v.visitante_nome, v.visitante_telefone, v.observacoes, v.checkin_token, v.nps_score,
    i.id, i.titulo, i.slug,
    concat_ws(', ',
      nullif(concat_ws(' ', i.endereco_logradouro, i.endereco_numero), ' '),
      i.endereco_bairro,
      concat_ws('/', i.endereco_cidade, i.endereco_uf)
    ) AS imovel_endereco,
    t.nome AS tenant_nome
  FROM public.visitas v
  JOIN public.imoveis i ON i.id = v.imovel_id
  JOIN public.tenants t ON t.id = v.tenant_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE v.visitante_email IS NOT NULL
    AND lower(v.visitante_email) = lower(u.email)
  ORDER BY v.data_hora DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.public_minhas_visitas() FROM anon;
GRANT EXECUTE ON FUNCTION public.public_minhas_visitas() TO authenticated;
