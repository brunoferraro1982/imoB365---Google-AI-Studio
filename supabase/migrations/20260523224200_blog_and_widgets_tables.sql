-- Tabelas para os novos módulos de Blog e Widgets de Conversão (WordPress Style)

-- 1. Tabela de Blog Posts
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  titulo text not null,
  slug text not null,
  conteudo text not null default '',
  resumo text,
  imagem_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  categoria text,
  autor_id uuid references public.profiles(id) on delete set null,
  visualizacoes int not null default 0,
  seo_titulo text,
  seo_description text,
  seo_keywords text,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index idx_blog_posts_tenant on public.blog_posts(tenant_id);
create index idx_blog_posts_status on public.blog_posts(status);

alter table public.blog_posts enable row level security;

-- Políticas para Blog Posts
create policy "blog_posts_members_read" on public.blog_posts
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "blog_posts_member_write" on public.blog_posts
  for all to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id))
  with check (is_member_of_tenant(auth.uid(), tenant_id));

create policy "blog_posts_super_admin_all" on public.blog_posts
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create policy "blog_posts_public_read" on public.blog_posts
  for select to anon, authenticated
  using (status = 'publicado');

create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.tg_set_updated_at();


-- 2. Tabela de Widgets de Conversão
create table public.conversion_widgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  slug text not null,
  tipo text not null default 'whatsapp' check (tipo in ('whatsapp', 'captura_leads', 'calculadora_financ', 'banner_cta')),
  ativo boolean not null default true,
  posicao text not null default 'bottom-right' check (posicao in ('bottom-right', 'bottom-left', 'top-right', 'top-left', 'inline')),
  texto_cta text,
  texto_whatsapp text,
  telefone_whatsapp text,
  cor_fundo text,
  cor_texto text,
  configuracoes_adicionais jsonb not null default '{}'::jsonb,
  views_count int not null default 0,
  leads_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index idx_widgets_tenant on public.conversion_widgets(tenant_id);

alter table public.conversion_widgets enable row level security;

-- Políticas para Widgets de Conversão
create policy "widgets_members_read" on public.conversion_widgets
  for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));

create policy "widgets_member_write" on public.conversion_widgets
  for all to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id))
  with check (is_member_of_tenant(auth.uid(), tenant_id));

create policy "widgets_super_admin_all" on public.conversion_widgets
  for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create policy "widgets_public_read" on public.conversion_widgets
  for select to anon, authenticated
  using (ativo = true);

create trigger trg_conversion_widgets_updated_at
  before update on public.conversion_widgets
  for each row execute function public.tg_set_updated_at();
