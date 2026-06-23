-- ============================================================
-- imoB365 — Migration: Políticas de MFA
-- Sprint 2 | 2026-06-22
--
-- Regras:
--   mfa_required = TRUE  → perfis gestor e financeiro (por padrão)
--   mfa_exempt   = TRUE  → super admin imob365br@gmail.com
--                          (ativar MFA ao entrar em produção)
--
-- Colunas já criadas pela migration 20260622000003.
-- Esta migration apenas seta os valores corretos.
-- ============================================================

-- ── 1. Garantir colunas existem (idempotente) ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_exempt   BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. MFA obrigatório para perfis de alto privilégio ─────────────────────
-- Perfis que têm acesso financeiro ou administrativo completo
UPDATE public.profiles
SET mfa_required = TRUE
WHERE tipo_usuario IN (
  'perfil-adm-imob',    -- Gestor de Imobiliária
  'perfil-finac-imob'   -- Financeiro
)
AND mfa_exempt = FALSE;

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE mfa_required = TRUE;
  RAISE NOTICE 'Perfis com MFA obrigatório: %', v_count;
END $$;

-- ── 3. Super admin: isento de MFA até entrar em produção ─────────────────
-- CONSTRAINT: imob365br@gmail.com não terá MFA enforçado em dev/homologação
-- Ativar (mfa_exempt = FALSE) ao fazer deploy em produção
UPDATE public.profiles
SET
  mfa_required = FALSE,
  mfa_exempt   = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'imob365br@gmail.com'
);

DO $$
DECLARE v_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rows
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'imob365br@gmail.com' AND p.mfa_exempt = TRUE;

  IF v_rows > 0 THEN
    RAISE NOTICE '✅ Super admin imob365br@gmail.com: mfa_exempt=TRUE (ativar ao ir para produção)';
  ELSE
    RAISE NOTICE '⚠️  Super admin não encontrado — execute após criar o usuário';
  END IF;
END $$;

-- ── 4. RLS: usuário só vê seu próprio status MFA ──────────────────────────
-- (profiles já deve ter RLS — apenas garantindo política específica)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_mfa_self_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY profiles_mfa_self_read ON public.profiles
        FOR SELECT USING (id = auth.uid());
    $policy$;
    RAISE NOTICE 'Política profiles_mfa_self_read criada';
  ELSE
    RAISE NOTICE 'Política profiles_mfa_self_read já existe';
  END IF;
END $$;

-- ── 5. Índice para queries de MFA ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_mfa
  ON public.profiles(mfa_required, mfa_exempt)
  WHERE mfa_required = TRUE;

-- ── 6. Resumo final ───────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '=== Status MFA por tipo de usuário ===';
  FOR r IN
    SELECT
      tipo_usuario,
      COUNT(*) as total,
      SUM(CASE WHEN mfa_required THEN 1 ELSE 0 END) as com_mfa,
      SUM(CASE WHEN mfa_exempt THEN 1 ELSE 0 END) as isentos
    FROM public.profiles
    WHERE tipo_usuario IS NOT NULL
    GROUP BY tipo_usuario
    ORDER BY tipo_usuario
  LOOP
    RAISE NOTICE '  %-22s | total: % | mfa_required: % | exempt: %',
      r.tipo_usuario, r.total, r.com_mfa, r.isentos;
  END LOOP;
END $$;

COMMENT ON COLUMN public.profiles.mfa_required IS
  'TRUE = MFA obrigatório. Setado automaticamente para gestor e financeiro.';
COMMENT ON COLUMN public.profiles.mfa_exempt IS
  'TRUE = isento de MFA. Usado para super admin em ambiente dev/homologação.
   PRODUÇÃO: definir FALSE para todos antes do go-live.';
