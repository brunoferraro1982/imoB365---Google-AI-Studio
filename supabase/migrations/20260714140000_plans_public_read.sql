-- /planos é uma página pública de marketing (preços/limites para visitantes decidirem
-- assinar), mas a única policy de SELECT em plans era "to authenticated" — visitantes
-- anônimos recebiam 0 linhas do Supabase, deixando a tabela de planos vazia sem
-- nenhum erro visível. Preço e limites de plano não são dado sensível de tenant, então
-- liberar leitura pública (mesmo padrão já usado em tenants/blog/widgets).
drop policy if exists "plans_read_authenticated" on public.plans;
create policy "plans_read_public" on public.plans
  for select to anon, authenticated
  using (true);
