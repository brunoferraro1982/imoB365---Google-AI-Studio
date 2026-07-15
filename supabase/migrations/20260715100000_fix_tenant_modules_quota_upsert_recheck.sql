-- Corrige um segundo bug na cota de módulos, exposto agora que o plano
-- candidato é validado corretamente (migration anterior): reenviar a MESMA
-- seleção de módulos (sem nenhuma mudança) para um tenant já no limite da
-- cota (ex.: Pro, 8/8) continuava travando com "Cota de módulos atingida".
--
-- Motivo: set_tenant_optional_modules faz um único
-- INSERT ... ON CONFLICT (tenant_id, module_slug) DO UPDATE. O Postgres
-- sempre dispara o trigger BEFORE INSERT para cada linha candidata ANTES de
-- verificar se há conflito — mesmo quando a linha já existe e só vai ser
-- atualizada (comportamento documentado do ON CONFLICT DO UPDATE). Nessa
-- primeira passada TG_OP = 'INSERT', então a condição antiga
-- "TG_OP = 'UPDATE' and OLD.enabled = true" nunca é verdadeira, e a cota é
-- checada de novo mesmo para módulos que já estavam habilitados e não
-- mudaram.
--
-- Fix: em vez de confiar em TG_OP/OLD (que não é confiável nessa fase do
-- ON CONFLICT), consulta diretamente o estado atual da tabela para saber se
-- o módulo já estava habilitado.
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
  _override text;
  _already_enabled boolean;
begin
  if new.enabled = false then
    return new;
  end if;

  select core into _is_core from public.modules where slug = new.module_slug;
  if coalesce(_is_core, false) = true then
    return new;
  end if;

  select exists (
    select 1 from public.tenant_modules
    where tenant_id = new.tenant_id
      and module_slug = new.module_slug
      and enabled = true
  ) into _already_enabled;
  if _already_enabled then
    return new;
  end if;

  _override := nullif(current_setting('app.tenant_modules_plano_override', true), '');
  select quota, used into _quota, _used from public.tenant_modules_quota(new.tenant_id, _override);

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
