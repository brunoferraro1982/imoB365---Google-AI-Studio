-- Item 1: bloqueia cadastro acima da cota do plano (imóveis / usuários).
-- Limite vem de plans.limites; -1 = ilimitado; super_admin não é bloqueado.
create or replace function public.enforce_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plano text;
  v_limit int;
  v_count int;
  v_key text := TG_ARGV[0];
begin
  if public.is_super_admin_safe() then
    return new;
  end if;
  if new.tenant_id is null then
    return new;
  end if;

  select t.plano_slug into v_plano from public.tenants t where t.id = new.tenant_id;
  select (p.limites ->> v_key)::int into v_limit from public.plans p where p.slug = v_plano;

  -- sem limite definido ou ilimitado => libera
  if v_limit is null or v_limit < 0 then
    return new;
  end if;

  execute format('select count(*) from public.%I where tenant_id = $1', TG_TABLE_NAME)
    into v_count using new.tenant_id;

  if v_count >= v_limit then
    raise exception 'Limite do plano atingido (%: % de %). Faça upgrade do plano para adicionar mais.',
      v_key, v_count, v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists tg_limit_imoveis on public.imoveis;
create trigger tg_limit_imoveis
  before insert on public.imoveis
  for each row execute function public.enforce_plan_limit('imoveis');

drop trigger if exists tg_limit_corretores on public.corretores;
create trigger tg_limit_corretores
  before insert on public.corretores
  for each row execute function public.enforce_plan_limit('usuarios');
