-- Habilitação de módulos por tenant passa a ser decisão exclusiva do
-- super_admin (vinculada ao plano contratado), não mais self-service pelo
-- admin do próprio tenant. A tela /app/configuracoes vira somente leitura;
-- a gestão real acontece em /admin/modulos.
DROP POLICY IF EXISTS "tenant_modules_admin_write" ON public.tenant_modules;
