-- Migration: 20260615000004_elearning_slug_unique_constraint
-- Objetivo: Substituir partial index por UNIQUE CONSTRAINT em elearning_cursos(tenant_id, slug)
-- Necessário para que o PostgREST aceite .upsert({ onConflict: "slug,tenant_id" })
-- Executado em: 2026-06-15 via Supabase SQL Editor

-- 1. Remove o partial index criado na migration 000003 (WHERE slug IS NOT NULL)
DROP INDEX IF EXISTS idx_elearning_cursos_slug_tenant;

-- 2. Remove constraint anterior caso exista (idempotência)
ALTER TABLE public.elearning_cursos
  DROP CONSTRAINT IF EXISTS elearning_cursos_tenant_slug_key;

-- 3. Cria UNIQUE CONSTRAINT real (requerido pelo PostgREST para onConflict)
ALTER TABLE public.elearning_cursos
  ADD CONSTRAINT elearning_cursos_tenant_slug_key UNIQUE (tenant_id, slug);

-- Verificação
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.elearning_cursos'::regclass
ORDER BY conname;
-- Esperado: linha com contype='u' e def='UNIQUE (tenant_id, slug)'
