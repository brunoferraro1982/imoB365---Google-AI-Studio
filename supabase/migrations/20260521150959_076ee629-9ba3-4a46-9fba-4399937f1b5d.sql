create or replace function public.public_create_tenant_lead(
  _tenant_slug text,
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
  if length(coalesce(_nome,'')) < 2 then raise exception 'Nome obrigatório'; end if;
  if length(coalesce(_nome,'')) > 200 then raise exception 'Nome muito longo'; end if;
  if coalesce(length(_email),0) > 255 or coalesce(length(_telefone),0) > 40 or coalesce(length(_mensagem),0) > 2000 then
    raise exception 'Campos excedem limite';
  end if;

  select id into _tenant from public.tenants where slug = _tenant_slug;
  if _tenant is null then raise exception 'Imobiliária não encontrada'; end if;

  -- só aceita se o site estiver publicado
  if not exists (select 1 from public.tenant_site_settings where tenant_id = _tenant and publicado = true) then
    raise exception 'Site não publicado';
  end if;

  _corretor := public.assign_lead_round_robin(_tenant);

  insert into public.leads(tenant_id, corretor_id, nome, email, telefone, mensagem, origem, status)
    values (_tenant, _corretor, _nome, nullif(_email,''), nullif(_telefone,''), nullif(_mensagem,''), 'site', 'novo')
    returning id into _lead_id;

  if _corretor is not null then
    insert into public.lead_interacoes(lead_id, tenant_id, tipo, conteudo, metadata)
      values (_lead_id, _tenant, 'atribuicao', 'Atribuído automaticamente (site)', jsonb_build_object('corretor_id', _corretor));
  end if;

  return _lead_id;
end;
$$;

grant execute on function public.public_create_tenant_lead(text, text, text, text, text) to anon, authenticated;