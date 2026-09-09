-- Busca por localidade independente do tamanho do catálogo. Antes,
-- /buscar buscava um pool de até 240 imóveis mais recentes (order by
-- updated_at desc) e SÓ DEPOIS filtrava por texto no client — conforme o
-- catálogo cresce além de 240, um imóvel publicado de uma cidade que não
-- foi atualizada recentemente some silenciosamente da busca, mesmo com o
-- texto batendo perfeitamente (mesma classe de bug já corrigida antes
-- neste projeto pro ".limit(12)" da vitrine da home). Corrigido movendo a
-- comparação de texto pro banco, ANTES do corte de linhas, usando
-- unaccent (extensão padrão/contrib do Postgres) — resolve ao mesmo tempo
-- o problema de escala e o de acento (antes só corrigido em JS no
-- client), sem depender de normalização feita fora do banco. Sem SCHEMA
-- explícito de propósito, mesmo padrão já usado pra pgcrypto neste
-- projeto — evita depender de um schema "extensions" estar no
-- search_path de quem chama a função.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() não é IMMUTABLE por padrão (o dicionário pode mudar em
-- runtime, na visão do Postgres) — não dá pra usar direto numa coluna
-- gerada ou índice funcional sem esse wrapper. Padrão documentado da
-- própria comunidade Postgres pra isso: chamar a forma de 2 argumentos
-- com o dicionário como literal, o que remove a dependência de runtime.
CREATE OR REPLACE FUNCTION public.imob365_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT unaccent('unaccent', coalesce($1, ''))
$$;

GRANT EXECUTE ON FUNCTION public.imob365_unaccent(text) TO anon, authenticated, service_role;

ALTER TABLE public.imoveis
  ADD COLUMN busca_localizacao text
  GENERATED ALWAYS AS (
    public.imob365_unaccent(
      lower(coalesce(titulo, '') || ' ' || coalesce(endereco_cidade, '') || ' ' || coalesce(endereco_bairro, ''))
    )
  ) STORED;

-- Índice trigram: essencial pra um ilike '%termo%' (sem âncora no início)
-- continuar rápido conforme o catálogo cresce — um índice btree comum não
-- serve pra esse padrão de busca.
CREATE INDEX idx_imoveis_busca_localizacao_trgm
  ON public.imoveis USING gin (busca_localizacao gin_trgm_ops);
