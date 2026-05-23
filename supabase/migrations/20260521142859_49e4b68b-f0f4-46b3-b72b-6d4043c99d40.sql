
-- Enums
create type public.lead_status as enum ('novo','contato','visita','proposta','ganho','perdido');
create type public.lead_origem as enum ('site','whatsapp','portal','indicacao','manual','outro');
create type public.lead_interacao_tipo as enum ('nota','ligacao','whatsapp','email','visita','mudanca_etapa','atribuicao');

-- leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  imovel_id uuid,
  corretor_id uuid,
  nome text not null,
  email text,
  telefone text,
  mensagem text,
  origem lead_origem not null default 'site',
  status lead_status not null default 'novo',
  perdido_motivo text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_tenant_status_idx on public.leads(tenant_id, status);
create index leads_tenant_created_idx on public.leads(tenant_id, created_at desc);
create index leads_corretor_idx on public.leads(corretor_id);

alter table public.leads enable row level security;

create policy leads_members_read on public.leads for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));
create policy leads_admin_write on public.leads for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
create policy leads_corretor_update on public.leads for update to authenticated
  using (corretor_id in (select id from public.corretores where user_id = auth.uid()))
  with check (corretor_id in (select id from public.corretores where user_id = auth.uid()));
create policy leads_super_admin_all on public.leads for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.tg_set_updated_at();

-- lead_interacoes
create table public.lead_interacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  tenant_id uuid not null,
  user_id uuid,
  tipo lead_interacao_tipo not null,
  conteudo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_interacoes_lead_idx on public.lead_interacoes(lead_id, created_at desc);
alter table public.lead_interacoes enable row level security;

create policy lead_interacoes_members_read on public.lead_interacoes for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));
create policy lead_interacoes_members_insert on public.lead_interacoes for insert to authenticated
  with check (is_member_of_tenant(auth.uid(), tenant_id));
create policy lead_interacoes_admin_delete on public.lead_interacoes for delete to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
create policy lead_interacoes_super_admin_all on public.lead_interacoes for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

-- tenant_lead_settings (round-robin pointer)
create table public.tenant_lead_settings (
  tenant_id uuid primary key,
  round_robin_enabled boolean not null default true,
  last_assigned_corretor_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.tenant_lead_settings enable row level security;

create policy tls_members_read on public.tenant_lead_settings for select to authenticated
  using (is_member_of_tenant(auth.uid(), tenant_id));
create policy tls_admin_write on public.tenant_lead_settings for all to authenticated
  using (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  with check (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
create policy tls_super_admin_all on public.tenant_lead_settings for all to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

-- Round-robin function
create or replace function public.assign_lead_round_robin(_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _last uuid;
  _next uuid;
  _enabled boolean;
begin
  insert into public.tenant_lead_settings(tenant_id)
    values (_tenant_id) on conflict (tenant_id) do nothing;

  select last_assigned_corretor_id, round_robin_enabled
    into _last, _enabled
    from public.tenant_lead_settings
    where tenant_id = _tenant_id;

  if coalesce(_enabled, true) = false then
    return null;
  end if;

  -- próximo corretor ativo após _last (ordem por created_at, id)
  select id into _next
  from public.corretores
  where tenant_id = _tenant_id and ativo = true
    and (_last is null
         or (created_at, id) > (
           select created_at, id from public.corretores where id = _last
         ))
  order by created_at, id
  limit 1;

  if _next is null then
    -- volta para o primeiro
    select id into _next
    from public.corretores
    where tenant_id = _tenant_id and ativo = true
    order by created_at, id
    limit 1;
  end if;

  if _next is not null then
    update public.tenant_lead_settings
      set last_assigned_corretor_id = _next, updated_at = now()
      where tenant_id = _tenant_id;
  end if;

  return _next;
end;
$$;

-- Public capture (anon) – validates the imóvel pertence ao tenant e está publicado
create or replace function public.public_create_lead(
  _imovel_id uuid,
  _nome text,
  _email text,
  _telefone text,
  _mensagem text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant uuid;
  _corretor uuid;
  _lead_id uuid;
begin
  if length(coalesce(_nome,'')) < 2 then
    raise exception 'Nome obrigatório';
  end if;
  if length(coalesce(_nome,'')) > 200 then
    raise exception 'Nome muito longo';
  end if;
  if coalesce(length(_email),0) > 255 or coalesce(length(_telefone),0) > 40 or coalesce(length(_mensagem),0) > 2000 then
    raise exception 'Campos excedem limite';
  end if;

  select tenant_id, corretor_responsavel_id into _tenant, _corretor
    from public.imoveis
    where id = _imovel_id and publicado = true and status = 'ativo';

  if _tenant is null then
    raise exception 'Imóvel não encontrado';
  end if;

  if _corretor is null then
    _corretor := public.assign_lead_round_robin(_tenant);
  end if;

  insert into public.leads(tenant_id, imovel_id, corretor_id, nome, email, telefone, mensagem, origem, status)
    values (_tenant, _imovel_id, _corretor, _nome, nullif(_email,''), nullif(_telefone,''), nullif(_mensagem,''), 'site', 'novo')
    returning id into _lead_id;

  if _corretor is not null then
    insert into public.lead_interacoes(lead_id, tenant_id, tipo, conteudo, metadata)
      values (_lead_id, _tenant, 'atribuicao', 'Atribuído automaticamente', jsonb_build_object('corretor_id', _corretor));
  end if;

  return _lead_id;
end;
$$;

revoke all on function public.public_create_lead(uuid,text,text,text,text) from public;
grant execute on function public.public_create_lead(uuid,text,text,text,text) to anon, authenticated;
revoke all on function public.assign_lead_round_robin(uuid) from public;
grant execute on function public.assign_lead_round_robin(uuid) to authenticated;
