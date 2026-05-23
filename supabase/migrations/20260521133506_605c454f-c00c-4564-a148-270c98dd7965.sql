
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum (
  'super_admin',
  'admin',
  'broker',
  'juridico',
  'financeiro',
  'atendente'
);

create type public.tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');

-- =========================================================
-- PLANS (catálogo global)
-- =========================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  preco_mensal numeric(10,2) not null default 0,
  modulos_incluidos text[] not null default '{}',
  limites jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;

-- =========================================================
-- MODULES (catálogo global)
-- =========================================================
create table public.modules (
  slug text primary key,
  nome text not null,
  descricao text,
  versao text not null default '1.0.0',
  settings_schema jsonb not null default '{}'::jsonb,
  requires_plan text references public.plans(slug) on delete set null,
  depends_on text[] not null default '{}',
  permissions text[] not null default '{}',
  core boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.modules enable row level security;

-- =========================================================
-- TENANTS
-- =========================================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  cnpj text,
  creci_juridico text,
  plano_slug text references public.plans(slug) on delete set null,
  dominio_proprio text unique,
  tema jsonb not null default '{}'::jsonb,
  status public.tenant_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tenants enable row level security;
create index idx_tenants_slug on public.tenants(slug);

-- =========================================================
-- TENANT_MODULES (módulos ativos por tenant)
-- =========================================================
create table public.tenant_modules (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_slug text not null references public.modules(slug) on delete cascade,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module_slug)
);
alter table public.tenant_modules enable row level security;

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  nome text,
  avatar_url text,
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index idx_profiles_tenant on public.profiles(tenant_id);

-- =========================================================
-- USER_ROLES (roles por usuário/tenant)
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id, role)
);
alter table public.user_roles enable row level security;
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_tenant on public.user_roles(tenant_id);

-- =========================================================
-- GLOBAL SETTINGS
-- =========================================================
create table public.global_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.global_settings enable row level security;

-- =========================================================
-- AUDIT LOG (append-only)
-- =========================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index idx_audit_tenant on public.audit_log(tenant_id);
create index idx_audit_user on public.audit_log(user_id);

-- =========================================================
-- SECURITY DEFINER FUNCTIONS
-- =========================================================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.has_role_in_tenant(_user_id uuid, _tenant_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
      and (tenant_id = _tenant_id or tenant_id is null)
  );
$$;

create or replace function public.is_member_of_tenant(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and tenant_id = _tenant_id
  );
$$;

create or replace function public.current_tenant_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = _user_id;
$$;

-- =========================================================
-- TRIGGERS - updated_at
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger tg_plans_updated_at before update on public.plans
  for each row execute function public.tg_set_updated_at();
create trigger tg_modules_updated_at before update on public.modules
  for each row execute function public.tg_set_updated_at();
create trigger tg_tenants_updated_at before update on public.tenants
  for each row execute function public.tg_set_updated_at();
create trigger tg_tenant_modules_updated_at before update on public.tenant_modules
  for each row execute function public.tg_set_updated_at();
create trigger tg_profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- TRIGGER - cria profile automaticamente em signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- PLANS: leitura pública para autenticados; super_admin gerencia
create policy "plans_read_authenticated" on public.plans
  for select to authenticated using (true);
create policy "plans_super_admin_all" on public.plans
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- MODULES: leitura pública para autenticados; super_admin gerencia
create policy "modules_read_authenticated" on public.modules
  for select to authenticated using (true);
create policy "modules_super_admin_all" on public.modules
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- TENANTS: super_admin vê tudo; membros veem seu próprio tenant
create policy "tenants_super_admin_all" on public.tenants
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
create policy "tenants_members_read" on public.tenants
  for select to authenticated using (public.is_member_of_tenant(auth.uid(), id));
create policy "tenants_admin_update" on public.tenants
  for update to authenticated
  using (public.has_role_in_tenant(auth.uid(), id, 'admin'))
  with check (public.has_role_in_tenant(auth.uid(), id, 'admin'));

-- TENANT_MODULES: super_admin tudo; admin do tenant gerencia o próprio
create policy "tenant_modules_super_admin_all" on public.tenant_modules
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
create policy "tenant_modules_members_read" on public.tenant_modules
  for select to authenticated using (public.is_member_of_tenant(auth.uid(), tenant_id));
create policy "tenant_modules_admin_write" on public.tenant_modules
  for all to authenticated
  using (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'))
  with check (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

-- PROFILES: cada um vê e edita o próprio; super_admin tudo; admin do tenant lê membros
create policy "profiles_self_read" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_super_admin_all" on public.profiles
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
create policy "profiles_tenant_admin_read" on public.profiles
  for select to authenticated
  using (tenant_id is not null and public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

-- USER_ROLES: cada um vê os próprios; super_admin tudo; admin do tenant gerencia roles do tenant (exceto super_admin)
create policy "user_roles_self_read" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "user_roles_super_admin_all" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
create policy "user_roles_tenant_admin_read" on public.user_roles
  for select to authenticated
  using (tenant_id is not null and public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
create policy "user_roles_tenant_admin_write" on public.user_roles
  for insert to authenticated
  with check (
    tenant_id is not null
    and role <> 'super_admin'
    and public.has_role_in_tenant(auth.uid(), tenant_id, 'admin')
  );
create policy "user_roles_tenant_admin_delete" on public.user_roles
  for delete to authenticated
  using (
    tenant_id is not null
    and role <> 'super_admin'
    and public.has_role_in_tenant(auth.uid(), tenant_id, 'admin')
  );

-- GLOBAL_SETTINGS: somente super_admin
create policy "global_settings_super_admin_all" on public.global_settings
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- AUDIT_LOG: super_admin vê tudo; admin do tenant vê do próprio; insert via service-role
create policy "audit_log_super_admin_read" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));
create policy "audit_log_tenant_admin_read" on public.audit_log
  for select to authenticated
  using (tenant_id is not null and public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

-- =========================================================
-- SEED: planos base + módulos core
-- =========================================================
insert into public.plans (slug, nome, preco_mensal, modulos_incluidos, limites) values
  ('starter', 'Starter', 0,
   array['core','catalogo','crm','corretores','admin'],
   '{"imoveis": 25, "usuarios": 3}'::jsonb),
  ('pro', 'Pro', 199,
   array['core','catalogo','crm','corretores','admin','portais','cms','custom_fields'],
   '{"imoveis": 500, "usuarios": 15}'::jsonb),
  ('business', 'Business', 499,
   array['core','catalogo','crm','corretores','admin','portais','cms','custom_fields','juridico','financeiro','white_label','webhooks'],
   '{"imoveis": 5000, "usuarios": 50}'::jsonb);

insert into public.modules (slug, nome, descricao, requires_plan, core) values
  ('core',           'Core',                      'Autenticação, RBAC, auditoria',                 'starter', true),
  ('catalogo',       'Catálogo de Imóveis',       'CRUD de imóveis e fotos',                       'starter', true),
  ('crm',            'CRM de Leads',              'Captura, funil e atendimento',                  'starter', true),
  ('corretores',     'Gestão de Corretores',      'Cadastro, CRECI e comissionamento',             'starter', true),
  ('admin',          'Painel Administrativo',     'Configurações do tenant',                       'starter', true),
  ('portais',        'Portais Externos',          'Feed VRSync + importadores',                    'pro',     false),
  ('cms',            'CMS',                       'Páginas e blog',                                'pro',     false),
  ('custom_fields',  'Campos Customizados',       'Atributos extras em imóveis e leads',           'pro',     false),
  ('juridico',       'Jurídico',                  'Contratos e assinatura',                        'business',false),
  ('financeiro',     'Financeiro',                'Recebimentos, repasses e relatórios',           'business',false),
  ('white_label',    'White-label',               'Domínio próprio e branding completo',           'business',false),
  ('webhooks',       'Webhooks de saída',         'Integrações personalizadas',                    'business',false);
