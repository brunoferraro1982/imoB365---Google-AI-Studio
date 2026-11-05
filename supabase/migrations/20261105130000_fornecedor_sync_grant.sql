-- Em produção (self-hosted) a tabela foi criada pelo supabase_admin e ficou
-- sem grant nenhum — o service_role (usado pelo endpoint de sincronização)
-- não conseguia gravar o snapshot. Só o service_role precisa de acesso.
grant select, insert, update, delete on public.fornecedor_sync to service_role;
