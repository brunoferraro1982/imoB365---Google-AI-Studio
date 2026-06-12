-- =============================================================================
-- imoB365 — OAuth Migration
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Clean duplicate rows in user_roles (keeps the oldest ctid per pair)
DELETE FROM public.user_roles
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM public.user_roles
  GROUP BY user_id, role
);

-- 2. Add UNIQUE constraint to prevent future duplicates
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 3. Add oauth_provider column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS oauth_provider text;

-- 4. Add status column to profiles
--    active (default) | pending_approval | rejected | suspended
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending_approval', 'rejected', 'suspended'));

-- 5. Create pending_registrations table
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text        NOT NULL,
  nome             text,
  tipo_usuario     text        NOT NULL CHECK (tipo_usuario IN ('corretor', 'imobiliaria')),
  creci            text,
  cnpj             text,
  imobiliaria_nome text,
  tenant_id        uuid,
  created_at       timestamptz DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid        REFERENCES auth.users(id)
);

-- 6. Enable RLS on pending_registrations
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- 6a. Super admins can manage all registrations
CREATE POLICY IF NOT EXISTS "super_admin_manage_registrations"
  ON public.pending_registrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- 6b. Users can read their own pending registration
CREATE POLICY IF NOT EXISTS "user_read_own_registration"
  ON public.pending_registrations
  FOR SELECT
  USING (user_id = auth.uid());

-- 6c. Authenticated users can insert their own registration
CREATE POLICY IF NOT EXISTS "user_insert_own_registration"
  ON public.pending_registrations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 7. Verify RLS is ON for all public tables (manual check — result must be empty)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;

-- Done!
COMMENT ON TABLE public.pending_registrations IS
  'OAuth onboarding queue: users registered via social login awaiting admin approval';
