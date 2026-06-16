-- Item 5: plano Free entra direto (auto-aprovação) + mantém o anti-bypass (OWASP A01).
-- Um único trigger BEFORE INSERT OR UPDATE em profiles.
create or replace function public.protect_profile_privileged_cols()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_free boolean;
begin
  is_free := lower(coalesce(new.plano_pretendido, 'free')) in ('free','gratis','grátis');

  -- Free: aprovação automática (não passa pela fila)
  if is_free then
    new.aprovado := true;
  end if;

  -- Anti-bypass: em UPDATE, usuário comum não altera colunas privilegiadas
  if TG_OP = 'UPDATE' and not public.is_super_admin_safe() then
    if (new.aprovado is distinct from old.aprovado and not is_free)
       or (new.tenant_id is distinct from old.tenant_id)
       or (new.pagamento_validado is distinct from old.pagamento_validado) then
      raise exception 'Alteracao de coluna privilegiada do perfil nao autorizada';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_protect_profile_cols on public.profiles;
create trigger tg_protect_profile_cols
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_cols();

-- Backfill: aprova quem já está como Free e estava pendente
update public.profiles
   set aprovado = true
 where coalesce(aprovado,false) = false
   and lower(coalesce(plano_pretendido,'free')) in ('free','gratis','grátis');
