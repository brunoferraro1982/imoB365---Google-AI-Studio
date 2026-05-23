
-- Storage bucket para branding
insert into storage.buckets (id, name, public)
  values ('tenant-branding','tenant-branding', true)
  on conflict (id) do nothing;

create policy "tenant_branding_public_read"
  on storage.objects for select
  using (bucket_id = 'tenant-branding');

create policy "tenant_branding_admin_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tenant-branding'
    and public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy "tenant_branding_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tenant-branding'
    and public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy "tenant_branding_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tenant-branding'
    and public.has_role_in_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin')
  );

-- Enums
do $$ begin
  create type public.contrato_tipo as enum ('venda','locacao','permuta','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contrato_status as enum ('rascunho','ativo','encerrado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.parte_papel as enum ('comprador','vendedor','locador','locatario','fiador','procurador','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financeiro_tipo as enum ('receita','despesa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financeiro_status as enum ('pendente','pago','atrasado','cancelado');
exception when duplicate_object then null; end $$;

-- Tabela contratos
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  imovel_id uuid,
  lead_id uuid,
  corretor_id uuid,
  numero text,
  tipo contrato_tipo not null default 'venda',
  status contrato_status not null default 'rascunho',
  valor numeric not null default 0,
  comissao_percentual numeric,
  comissao_valor numeric,
  data_inicio date,
  data_fim date,
  observacoes text,
  arquivo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index idx_contratos_tenant on public.contratos(tenant_id);
create index idx_contratos_imovel on public.contratos(imovel_id);

alter table public.contratos enable row level security;

create policy "contratos_members_read" on public.contratos for select to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id));
create policy "contratos_admin_write" on public.contratos for all to authenticated
  using (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  with check (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
create policy "contratos_super_admin_all" on public.contratos for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create trigger trg_contratos_updated before update on public.contratos
  for each row execute function public.tg_set_updated_at();

-- Tabela contrato_partes
create table public.contrato_partes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tenant_id uuid not null,
  papel parte_papel not null,
  nome text not null,
  documento text,
  email text,
  telefone text,
  created_at timestamptz not null default now()
);
create index idx_partes_contrato on public.contrato_partes(contrato_id);

alter table public.contrato_partes enable row level security;
create policy "partes_members_read" on public.contrato_partes for select to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id));
create policy "partes_admin_write" on public.contrato_partes for all to authenticated
  using (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  with check (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
create policy "partes_super_admin_all" on public.contrato_partes for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Tabela lancamentos_financeiros
create table public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tipo financeiro_tipo not null,
  categoria text,
  descricao text not null,
  valor numeric not null default 0,
  data_vencimento date not null default current_date,
  data_pagamento date,
  status financeiro_status not null default 'pendente',
  contrato_id uuid references public.contratos(id) on delete set null,
  imovel_id uuid,
  corretor_id uuid,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index idx_lancamentos_tenant on public.lancamentos_financeiros(tenant_id);
create index idx_lancamentos_venc on public.lancamentos_financeiros(data_vencimento);

alter table public.lancamentos_financeiros enable row level security;
create policy "lanc_members_read" on public.lancamentos_financeiros for select to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id));
create policy "lanc_admin_write" on public.lancamentos_financeiros for all to authenticated
  using (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  with check (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
create policy "lanc_super_admin_all" on public.lancamentos_financeiros for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create trigger trg_lancamentos_updated before update on public.lancamentos_financeiros
  for each row execute function public.tg_set_updated_at();
