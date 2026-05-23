
create table public.portal_feeds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  portal_slug text not null,
  enabled boolean not null default true,
  last_pulled_at timestamptz,
  last_pull_ua text,
  last_pull_ip text,
  validation_status text,
  validation_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, portal_slug)
);
create index portal_feeds_tenant_idx on public.portal_feeds(tenant_id);

alter table public.portal_feeds enable row level security;

create policy portal_feeds_members_read on public.portal_feeds for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));
create policy portal_feeds_admin_write on public.portal_feeds for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
create policy portal_feeds_super_admin_all on public.portal_feeds for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create trigger portal_feeds_set_updated_at before update on public.portal_feeds
  for each row execute function public.tg_set_updated_at();
