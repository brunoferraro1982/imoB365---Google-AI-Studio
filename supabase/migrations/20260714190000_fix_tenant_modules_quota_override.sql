-- Corrige dois problemas encontrados ao testar o novo checkout do Mercado Pago
-- em /app/contratacao:
--
-- 1. tenant_modules_quota() validava a cota contra tenants.plano_slug (o plano
--    ATUAL do tenant), nunca o plano que o usuário está comprando no formulário
--    — já que a troca de plano de verdade só acontece depois (webhook do MP
--    confirma o pagamento, ou, no caso Free, só depois de salvar os módulos).
--    Resultado: trocar de plano sempre validava contra a cota do plano ANTIGO.
--
-- 2. A migration 20260713170000_restrict_tenant_modules_to_super_admin.sql
--    (já em produção) removeu a policy que permitia o admin do próprio tenant
--    escrever em tenant_modules — só super_admin pode hoje. Isso quebra o
--    self-service de módulos opcionais em /app/contratacao para qualquer
--    cliente real (só não apareceu no teste porque o usuário de teste era o
--    próprio super_admin). A tela de módulos em /app/configuracoes virou
--    somente-leitura de propósito; /app/contratacao precisa de um caminho
--    controlado e auditável para continuar funcionando — não de reabrir a
--    tabela para escrita direta.

-- 1) tenant_modules_quota agora aceita um plano "candidato" opcional — usado
--    durante a troca de plano, antes do plano real do tenant mudar.
drop function if exists public.tenant_modules_quota(uuid);

create or replace function public.tenant_modules_quota(_tenant_id uuid, _plano_slug_override text default null)
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
  left join public.plans p on p.slug = coalesce(_plano_slug_override, t.plano_slug)
  where t.id = _tenant_id;
$$;

revoke execute on function public.tenant_modules_quota(uuid, text) from public, anon;
grant execute on function public.tenant_modules_quota(uuid, text) to authenticated;

-- 2) O trigger passa a ler um override de sessão (setado só dentro da mesma
--    transação pela RPC abaixo) em vez de sempre confiar em tenants.plano_slug.
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
begin
  if new.enabled = false then
    return new;
  end if;

  select core into _is_core from public.modules where slug = new.module_slug;
  if coalesce(_is_core, false) = true then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.enabled = true then
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

-- 3) RPC única e auditável para o checkout self-service escolher módulos
--    opcionais contra o plano ALVO da compra. Chamada pelo client em vez do
--    upsert direto em tenant_modules (que hoje só permite super_admin via RLS).
--    Permissão: o próprio tenant (via profiles.tenant_id) ou super_admin.
create or replace function public.set_tenant_optional_modules(
  _tenant_id uuid,
  _plano_slug text,
  _module_slugs text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_tenant uuid;
begin
  select tenant_id into _caller_tenant from public.profiles where id = auth.uid();

  if not public.has_role(auth.uid(), 'super_admin')
     and (_caller_tenant is null or _caller_tenant <> _tenant_id) then
    raise exception 'Sem permissão para alterar módulos deste tenant.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.plans where slug = _plano_slug) then
    raise exception 'Plano % não encontrado.', _plano_slug;
  end if;

  perform set_config('app.tenant_modules_plano_override', _plano_slug, true);

  insert into public.tenant_modules (tenant_id, module_slug, enabled)
  select _tenant_id, m.slug, (m.core or m.slug = any(_module_slugs))
  from public.modules m
  on conflict (tenant_id, module_slug) do update
    set enabled = excluded.enabled;
end;
$$;

revoke execute on function public.set_tenant_optional_modules(uuid, text, text[]) from public, anon;
grant execute on function public.set_tenant_optional_modules(uuid, text, text[]) to authenticated;
