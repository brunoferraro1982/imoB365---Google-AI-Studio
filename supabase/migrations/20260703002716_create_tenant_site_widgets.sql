-- Widgets de CONTEÚDO para a barra lateral do site público de cada
-- imobiliária/corretor — diferente de conversion_widgets, que são
-- overlays flutuantes (WhatsApp, captura de leads). Estes widgets
-- inspirados no WordPress preenchem as colunas laterais do layout de
-- 3 colunas: imóveis recentes, posts do blog, contato, redes sociais,
-- banner publicitário e texto livre — tudo escolhido pelo próprio
-- contratante (imobiliária/corretor), não pela plataforma.

create table public.tenant_site_widgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tipo text not null check (tipo in (
    'imoveis_recentes', 'blog_recente', 'contato', 'redes_sociais',
    'banner_publicitario', 'texto_livre'
  )),
  posicao text not null default 'direita' check (posicao in ('esquerda', 'direita')),
  ordem int not null default 0,
  titulo text,
  ativo boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tenant_site_widgets_tenant on public.tenant_site_widgets(tenant_id);

alter table public.tenant_site_widgets enable row level security;

create policy "site_widgets_members_read" on public.tenant_site_widgets
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "site_widgets_member_write" on public.tenant_site_widgets
  for all to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id))
  with check (is_member_of_tenant(auth.uid(), tenant_id));

create policy "site_widgets_super_admin_all" on public.tenant_site_widgets
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create policy "site_widgets_public_read" on public.tenant_site_widgets
  for select to anon, authenticated
  using (ativo = true);

create trigger trg_tenant_site_widgets_updated_at
  before update on public.tenant_site_widgets
  for each row execute function public.tg_set_updated_at();

-- Bucket para imagens de banner publicitário enviadas pelo contratante.
insert into storage.buckets (id, name, public)
  values ('site-widgets', 'site-widgets', true)
  on conflict (id) do nothing;

create policy "site_widgets_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'site-widgets');

create policy "site_widgets_storage_member_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-widgets'
    and is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

create policy "site_widgets_storage_member_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-widgets'
    and is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

create policy "site_widgets_storage_member_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-widgets'
    and is_member_of_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
