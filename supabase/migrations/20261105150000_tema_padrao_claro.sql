-- Tema do /app: o padrão passa a ser claro. Escuro só quando o usuário escolhe
-- (Claro / Escuro / Automático). Perfis que estavam em 'system' por padrão
-- (nunca escolheram) voltam para 'light'.
alter table public.profiles alter column tema_preferido set default 'light';
update public.profiles set tema_preferido = 'light' where tema_preferido = 'system';
