
-- Reseed planos com a nova estrutura (cota de módulos opcionais em limites.modulos)
insert into public.plans (slug, nome, preco_mensal, modulos_incluidos, limites, ativo)
values
  ('basic',    'Basic',    99,  '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 50,  "usuarios": 3,  "modulos": 3}'::jsonb, true),
  ('standard', 'Standard', 199, '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 250, "usuarios": 8,  "modulos": 5}'::jsonb, true),
  ('pro',      'Pro',      349, '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 1000,"usuarios": 20, "modulos": 8}'::jsonb, true),
  ('business', 'Business', 599, '{core,catalogo,crm,corretores,admin}'::text[], '{"imoveis": 10000,"usuarios": 100,"modulos": -1}'::jsonb, true)
on conflict (slug) do update set
  nome = excluded.nome,
  preco_mensal = excluded.preco_mensal,
  modulos_incluidos = excluded.modulos_incluidos,
  limites = excluded.limites,
  ativo = true;

-- Remover plano antigo "starter" se ainda existir e não estiver em uso
update public.tenants set plano_slug = 'basic' where plano_slug = 'starter';
delete from public.plans where slug = 'starter';

-- Função utilitária de cota
create or replace function public.tenant_modules_quota(_tenant_id uuid)
returns table(quota int, used int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((p.limites->>'modulos')::int, 0) as quota,
    (
      select count(*)::int
      from public.tenant_modules tm
      join public.modules m on m.slug = tm.module_slug
      where tm.tenant_id = _tenant_id
        and tm.enabled = true
        and m.core = false
    ) as used
  from public.tenants t
  left join public.plans p on p.slug = t.plano_slug
  where t.id = _tenant_id;
$$;

revoke execute on function public.tenant_modules_quota(uuid) from public, anon;
grant execute on function public.tenant_modules_quota(uuid) to authenticated;

-- Trigger que aplica a cota
create or replace function public.tg_enforce_modules_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_core boolean;
  _quota int;
  _used int;
begin
  -- Só checa quando o módulo está sendo habilitado
  if new.enabled = false then
    return new;
  end if;

  select core into _is_core from public.modules where slug = new.module_slug;
  if coalesce(_is_core, false) = true then
    return new;
  end if;

  -- Se já estava habilitado antes (UPDATE de outro campo), não recontar
  if tg_op = 'UPDATE' and old.enabled = true then
    return new;
  end if;

  select quota, used into _quota, _used from public.tenant_modules_quota(new.tenant_id);

  if _quota = -1 then
    return new;
  end if;

  if _used >= coalesce(_quota, 0) then
    raise exception 'Cota de módulos do plano atingida (% de %).', _used, coalesce(_quota, 0)
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tenant_modules_quota on public.tenant_modules;
create trigger trg_tenant_modules_quota
  before insert or update on public.tenant_modules
  for each row execute function public.tg_enforce_modules_quota();
