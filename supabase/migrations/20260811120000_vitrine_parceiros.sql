-- Vitrine de Parceiros da home: lista única e ordenável de imobiliárias +
-- construtoras, curada pelo super_admin. Substitui o mecanismo antigo em que
-- o marquee lia direto construtoras.exibir_no_rodape (que passa a ser legado,
-- backfillado uma vez abaixo). O marquee é uma sequência só, por isso uma
-- tabela única que mistura os dois tipos (em vez de duas colunas de ordem).

CREATE TABLE IF NOT EXISTS public.vitrine_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('imobiliaria', 'construtora')),
  ref_id uuid NOT NULL, -- tenants.id (imobiliaria) ou construtoras.id (construtora)
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, ref_id)
);

ALTER TABLE public.vitrine_parceiros ENABLE ROW LEVEL SECURITY;

-- Leitura pública com USING(true) (não filtra por has_role — evita o gap de
-- EXECUTE em has_role pra anon já documentado no projeto). O marquee filtra
-- ativo=true na query; o super_admin vê tudo por esta mesma policy. As linhas
-- são só "quais logos aparecem na vitrine" — não é dado sensível.
CREATE POLICY "vitrine_parceiros_public_read" ON public.vitrine_parceiros
  FOR SELECT USING (true);

CREATE POLICY "vitrine_parceiros_super_admin_insert" ON public.vitrine_parceiros
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "vitrine_parceiros_super_admin_update" ON public.vitrine_parceiros
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "vitrine_parceiros_super_admin_delete" ON public.vitrine_parceiros
  FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- GRANT explícito pros 3 roles (lição do changelog: tabela aplicada via psql
-- direto não herda o default ACL; incluir sempre na própria migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitrine_parceiros TO anon, authenticated, service_role;

-- Backfill: construtoras já marcadas pro rodapé entram na vitrine (ordem por nome),
-- pra nada sumir da home ao trocar de mecanismo.
INSERT INTO public.vitrine_parceiros (tipo, ref_id, ordem, ativo)
SELECT 'construtora', c.id, (row_number() OVER (ORDER BY c.nome))::int - 1, true
FROM public.construtoras c
WHERE c.ativo = true AND c.exibir_no_rodape = true
ON CONFLICT (tipo, ref_id) DO NOTHING;
