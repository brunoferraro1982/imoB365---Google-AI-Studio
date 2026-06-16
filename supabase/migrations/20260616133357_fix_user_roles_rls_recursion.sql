-- Corrige RLS de user_roles: remove policies recursivas que disparavam
-- "infinite recursion detected in policy for relation user_roles" e quebravam
-- TODA leitura de papéis (useAuth -> roles=[] -> menu colapsado).
-- Super admin passa a ser verificado via função SECURITY DEFINER (sem recursão).

alter table public.user_roles enable row level security;

drop policy if exists super_admin_reads_all_roles on public.user_roles;
drop policy if exists super_admin_manages_roles  on public.user_roles;
drop policy if exists only_super_admin_inserts_roles on public.user_roles;
drop policy if exists user_sees_own_roles on public.user_roles;

-- Cada usuário lê os próprios papéis (não recursivo) — necessário para o useAuth.
create policy user_sees_own_roles on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- Super admin: acesso total via função SECURITY DEFINER (lê user_roles sem reaplicar RLS).
create policy super_admin_manages_roles on public.user_roles
  for all to authenticated
  using (public.is_super_admin_safe())
  with check (public.is_super_admin_safe());
