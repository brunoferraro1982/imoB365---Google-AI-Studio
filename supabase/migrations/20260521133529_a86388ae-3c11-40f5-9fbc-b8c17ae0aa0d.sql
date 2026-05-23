
-- Fix search_path on trigger functions
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Lock down SECURITY DEFINER helpers: revoke from anon, allow authenticated only
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.has_role_in_tenant(uuid, uuid, public.app_role) from public, anon;
revoke execute on function public.is_member_of_tenant(uuid, uuid) from public, anon;
revoke execute on function public.current_tenant_id(uuid) from public, anon;
revoke execute on function public.tg_set_updated_at() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role_in_tenant(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.is_member_of_tenant(uuid, uuid) to authenticated;
grant execute on function public.current_tenant_id(uuid) to authenticated;
