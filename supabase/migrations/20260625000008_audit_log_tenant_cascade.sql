-- Fix: audit_log.tenant_id FK bloqueia exclusão de tenants
-- Alterar para ON DELETE CASCADE para permitir remoção de tenants pelo admin

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_tenant_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
