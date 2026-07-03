-- Remove conversion_widgets: feature nunca chegou a ser renderizada no site público
-- (a página /app/site/widgets tinha CRUD e RLS, mas nenhum componente do portal lia essa
-- tabela — configurar um widget não tinha nenhum efeito visível para o corretor).
-- O sistema de widgets de conteúdo (public.tenant_site_widgets), que é o que realmente
-- funciona e é renderizado nas páginas públicas do tenant, não é afetado por esta migration.
drop table if exists public.conversion_widgets;
