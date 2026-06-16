-- A) Módulo 'marketing' ausente no catálogo (AppShell usa requiredModule 'marketing')
insert into public.modules (slug, nome, descricao, requires_plan, core)
values ('marketing','Marketing & Site','Site, blog, portais, widgets e relatorios','pro', false)
on conflict (slug) do nothing;

-- B) Provisionamento de módulos (alto nível do menu) por plano
create or replace function public.provision_tenant_modules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tier int;
  wanted text[];
  hi text[] := array['imobiliario','ajustes','financeiro','juridico','marketing','elearning'];
begin
  tier := case coalesce(new.plano_slug,'free')
            when 'free' then 0 when 'basic' then 1 when 'standard' then 2
            when 'pro' then 3 when 'business' then 4 else 0 end;
  wanted := array['imobiliario','ajustes'];
  if tier >= 2 then wanted := wanted || 'financeiro'::text; end if;
  if tier >= 3 then wanted := wanted || array['juridico','marketing']; end if;
  if tier >= 4 then wanted := wanted || 'elearning'::text; end if;

  insert into public.tenant_modules (tenant_id, module_slug, enabled)
  select new.id, w, true from unnest(wanted) w
  where not exists (select 1 from public.tenant_modules tm
                    where tm.tenant_id = new.id and tm.module_slug = w);

  update public.tenant_modules set enabled = true
   where tenant_id = new.id and module_slug = any(wanted);

  update public.tenant_modules set enabled = false
   where tenant_id = new.id and module_slug = any(hi) and not (module_slug = any(wanted));

  return new;
end;
$$;

drop trigger if exists tg_provision_tenant_modules on public.tenants;
create trigger tg_provision_tenant_modules
  after insert or update of plano_slug on public.tenants
  for each row execute function public.provision_tenant_modules();

-- C) Backfill: re-provisiona todos os tenants pelo plano atual
update public.tenants set plano_slug = plano_slug;
