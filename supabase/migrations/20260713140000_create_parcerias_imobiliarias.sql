-- Rede de parcerias entre imobiliárias (substitui a seção fake "MLS" em /app/portais)
-- Não abre nenhuma leitura nova de imoveis entre tenants: imoveis_public_read já é
-- pública para publicado=true + status='ativo' (mesma regra usada pelos sites públicos).

create table public.parcerias_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  ativo boolean not null default false,
  split_captador int not null default 50 check (split_captador between 0 and 100),
  split_parceiro int not null default 50 check (split_parceiro between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parcerias_settings_set_updated_at
  before update on public.parcerias_settings
  for each row execute function public.tg_set_updated_at();

alter table public.parcerias_settings enable row level security;

create policy parcerias_settings_own_read on public.parcerias_settings
  for select to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id));

create policy parcerias_settings_discovery_read on public.parcerias_settings
  for select to authenticated
  using (ativo = true);

create policy parcerias_settings_member_write on public.parcerias_settings
  for all to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id))
  with check (public.is_member_of_tenant(auth.uid(), tenant_id));

create policy parcerias_settings_super_admin_all on public.parcerias_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Convites/pedidos de parceria entre duas imobiliárias
create table public.parcerias_convites (
  id uuid primary key default gen_random_uuid(),
  tenant_solicitante_id uuid not null references public.tenants(id) on delete cascade,
  tenant_parceiro_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint parcerias_convites_tenants_diferentes check (tenant_solicitante_id <> tenant_parceiro_id)
);

create index parcerias_convites_solicitante_idx on public.parcerias_convites(tenant_solicitante_id);
create index parcerias_convites_parceiro_idx on public.parcerias_convites(tenant_parceiro_id);

-- Evita duplicar convite pendente/aceito entre o mesmo par de imobiliárias (em qualquer direção)
create unique index parcerias_convites_par_ativo_idx on public.parcerias_convites (
  least(tenant_solicitante_id, tenant_parceiro_id),
  greatest(tenant_solicitante_id, tenant_parceiro_id)
) where status in ('pendente', 'aceito');

alter table public.parcerias_convites enable row level security;

create policy parcerias_convites_members_read on public.parcerias_convites
  for select to authenticated
  using (
    public.is_member_of_tenant(auth.uid(), tenant_solicitante_id)
    or public.is_member_of_tenant(auth.uid(), tenant_parceiro_id)
  );

create policy parcerias_convites_solicitante_insert on public.parcerias_convites
  for insert to authenticated
  with check (public.is_member_of_tenant(auth.uid(), tenant_solicitante_id));

create policy parcerias_convites_member_update on public.parcerias_convites
  for update to authenticated
  using (
    public.is_member_of_tenant(auth.uid(), tenant_solicitante_id)
    or public.is_member_of_tenant(auth.uid(), tenant_parceiro_id)
  )
  with check (
    public.is_member_of_tenant(auth.uid(), tenant_solicitante_id)
    or public.is_member_of_tenant(auth.uid(), tenant_parceiro_id)
  );

create policy parcerias_convites_super_admin_all on public.parcerias_convites
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
