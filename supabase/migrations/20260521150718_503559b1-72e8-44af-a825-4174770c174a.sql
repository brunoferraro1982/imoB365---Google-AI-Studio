-- Configurações do site público (1 linha por tenant)
create table public.tenant_site_settings (
  tenant_id uuid primary key,
  publicado boolean not null default false,
  hero_titulo text,
  hero_subtitulo text,
  hero_cta_label text,
  sobre_html text,
  contato_telefone text,
  contato_whatsapp text,
  contato_email text,
  endereco text,
  instagram_url text,
  facebook_url text,
  youtube_url text,
  linkedin_url text,
  cor_destaque text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_site_settings enable row level security;

create policy "site_settings_members_read" on public.tenant_site_settings
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "site_settings_admin_write" on public.tenant_site_settings
  for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

create policy "site_settings_super_admin_all" on public.tenant_site_settings
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create policy "site_settings_public_read" on public.tenant_site_settings
  for select to anon, authenticated
  using (publicado = true);

create trigger trg_tenant_site_settings_updated_at
  before update on public.tenant_site_settings
  for each row execute function public.tg_set_updated_at();

-- Páginas customizadas do site (sobre, serviços, contato, etc.)
create table public.tenant_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slug text not null,
  titulo text not null,
  conteudo_html text not null default '',
  ordem int not null default 0,
  publicada boolean not null default false,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index idx_tenant_pages_tenant on public.tenant_pages(tenant_id);

alter table public.tenant_pages enable row level security;

create policy "pages_members_read" on public.tenant_pages
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "pages_admin_write" on public.tenant_pages
  for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

create policy "pages_super_admin_all" on public.tenant_pages
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create policy "pages_public_read" on public.tenant_pages
  for select to anon, authenticated
  using (publicada = true and exists (
    select 1 from public.tenant_site_settings s
    where s.tenant_id = tenant_pages.tenant_id and s.publicado = true
  ));

create trigger trg_tenant_pages_updated_at
  before update on public.tenant_pages
  for each row execute function public.tg_set_updated_at();