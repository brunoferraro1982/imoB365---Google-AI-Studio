-- CLM Sprint 15 — Integrações: majoritariamente wiring do que já foi
-- construído. Único trabalho genuinamente novo: o Portal do Proprietário
-- (hoje /conta/* só atende comprador/locatário-cliente, nenhum proprietário
-- consegue ver o próprio contrato). contrato_partes.email é texto livre sem
-- FK pra auth.users — mesmo padrão já usado em public_minhas_visitas()
-- (join por email, não por user_id) é replicado aqui.
CREATE OR REPLACE FUNCTION public.public_meus_contratos()
RETURNS TABLE(
  id uuid,
  numero text,
  tipo contrato_tipo,
  status contrato_status,
  etapa_atual text,
  valor numeric,
  data_inicio date,
  data_fim date,
  papel parte_papel,
  imovel_id uuid,
  imovel_titulo text,
  imovel_slug text,
  tenant_nome text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.numero, c.tipo, c.status, c.etapa_atual, c.valor, c.data_inicio, c.data_fim,
    p.papel,
    i.id, i.titulo, i.slug,
    t.nome AS tenant_nome
  FROM public.contrato_partes p
  JOIN public.contratos c ON c.id = p.contrato_id
  LEFT JOIN public.imoveis i ON i.id = c.imovel_id
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE p.papel IN ('vendedor', 'locador')
    AND p.email IS NOT NULL
    AND lower(p.email) = lower(u.email)
  ORDER BY c.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.public_meus_contratos() FROM anon;
GRANT EXECUTE ON FUNCTION public.public_meus_contratos() TO authenticated;
