
create table if not exists public.lead_mensagens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  autor_user_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  autor_tipo text not null default 'corretor' check (autor_tipo in ('corretor','sistema','lead')),
  conteudo text not null check (length(conteudo) between 1 and 4000),
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_mensagens_lead on public.lead_mensagens (lead_id, created_at);
create index if not exists idx_lead_mensagens_tenant on public.lead_mensagens (tenant_id, created_at desc);

alter table public.lead_mensagens enable row level security;

create policy "mensagens_select_tenant"
  on public.lead_mensagens for select
  to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id));

create policy "mensagens_insert_tenant"
  on public.lead_mensagens for insert
  to authenticated
  with check (
    public.is_member_of_tenant(auth.uid(), tenant_id)
    and (autor_user_id is null or autor_user_id = auth.uid())
  );

create policy "mensagens_update_tenant"
  on public.lead_mensagens for update
  to authenticated
  using (public.is_member_of_tenant(auth.uid(), tenant_id))
  with check (public.is_member_of_tenant(auth.uid(), tenant_id));

create policy "mensagens_delete_admin"
  on public.lead_mensagens for delete
  to authenticated
  using (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));

alter table public.lead_mensagens replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lead_mensagens'
  ) then
    execute 'alter publication supabase_realtime add table public.lead_mensagens';
  end if;
end$$;
