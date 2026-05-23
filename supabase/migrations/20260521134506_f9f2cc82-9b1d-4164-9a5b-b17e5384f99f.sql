INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('a6ed2fdb-2c84-40af-8ce8-6fd4b8d6dba6', 'super_admin', NULL)
ON CONFLICT DO NOTHING;