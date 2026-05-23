create table public.contrato_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nome text not null,
  tipo contrato_tipo not null default 'venda',
  conteudo text not null default '',
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contrato_templates_tenant on public.contrato_templates(tenant_id);

alter table public.contrato_templates enable row level security;

create policy "templates_members_read" on public.contrato_templates
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "templates_admin_write" on public.contrato_templates
  for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

create policy "templates_super_admin_all" on public.contrato_templates
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create trigger trg_contrato_templates_updated_at
  before update on public.contrato_templates
  for each row execute function public.tg_set_updated_at();