-- Sprint 3: Onboarding Wizard
-- Adiciona campo de dismiss no tenant e policy RLS para o dashboard de onboarding

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ;

-- Permite que o admin do tenant atualize o campo de dismiss
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants'
      AND policyname = 'tenant_admin_update_onboarding'
  ) THEN
    CREATE POLICY "tenant_admin_update_onboarding"
      ON public.tenants
      FOR UPDATE
      USING (
        id IN (
          SELECT tenant_id FROM public.profiles
          WHERE id = auth.uid()
            AND tipo_usuario IN ('perfil-adm-imob', 'super_admin')
        )
      )
      WITH CHECK (true);
  END IF;
END $$;
