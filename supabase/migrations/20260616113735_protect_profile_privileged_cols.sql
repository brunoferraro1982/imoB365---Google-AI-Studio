-- Backstop de segurança (OWASP A01): impede que o próprio usuário altere
-- colunas privilegiadas do seu profile. Fonte de verdade de aprovação/tenant
-- passa a ser inviolável via cliente, mesmo com as policies de self_update.

create or replace function public.protect_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- super_admin pode tudo
  if public.is_super_admin_safe() then
    return new;
  end if;
  if (new.aprovado is distinct from old.aprovado)
     or (new.tenant_id is distinct from old.tenant_id)
     or (new.pagamento_validado is distinct from old.pagamento_validado) then
    raise exception 'Alteração de coluna privilegiada do perfil não autorizada';
  end if;
  return new;
end;
$$;

drop trigger if exists tg_protect_profile_cols on public.profiles;
create trigger tg_protect_profile_cols
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_cols();
