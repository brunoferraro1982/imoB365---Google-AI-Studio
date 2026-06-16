create index if not exists idx_profiles_aprovado on public.profiles(aprovado);
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
