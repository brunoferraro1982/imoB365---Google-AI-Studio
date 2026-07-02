-- blog_posts_public_read (criada em 20260523224200_blog_and_widgets_tables.sql)
-- deveria permitir leitura anônima de posts com status='publicado', mas
-- estava retornando zero linhas mesmo para queries triviais sem nenhum
-- outro filtro — confirmado com um client anônimo puro (sem sessão),
-- enquanto a leitura pública equivalente em outras tabelas (ex.: imoveis)
-- funciona normalmente. Recriando a policy do zero para garantir que ela
-- realmente esteja em vigor (mesma causa/efeito já visto em outra policy
-- nesta base que só passou a funcionar depois de recriada, não apenas
-- corrigida via REPLACE).

DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
CREATE POLICY "blog_posts_public_read" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'publicado');
