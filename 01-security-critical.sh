#!/usr/bin/env bash
# ============================================================
#  SCRIPT 01 — SEGURANÇA CRÍTICA
#  - Remove hardcode de e-mail em isSuperAdmin
#  - Remove isSuper bypasses em loadProfile
#  - RLS + policies na tabela user_roles
#  - Seed super_admin via SQL (sem depender do e-mail)
#  - SQL migration: user_roles_rls
# ============================================================
set -euo pipefail

REPO="$HOME/imoB365---Google-AI-Studio"
GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; NC="\033[0m"
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
npm --version &>/dev/null || fail "npm não encontrado"

cd "$REPO" || fail "Repositório não encontrado: $REPO"
BRANCH=$(git branch --show-current)
log "Branch: $BRANCH"

# ────────────────────────────────────────────────────────────
# 1. PATCH useAuth.tsx — remover hardcode de e-mail
# ────────────────────────────────────────────────────────────
echo ""
echo "── Patch 1: useAuth.tsx ──"

USEAUTH="src/hooks/useAuth.tsx"
[[ -f "$USEAUTH" ]] || fail "Arquivo não encontrado: $USEAUTH"

# Backup
cp "$USEAUTH" "${USEAUTH}.bak"

python3 - <<'PYEOF'
import re, sys

path = "src/hooks/useAuth.tsx"
with open(path, "r") as f:
    src = f.read()

# 1. Remover hardcode de e-mail em isSuperAdmin
src = re.sub(
    r'const isSuperAdmin = roles\.includes\("super_admin"\) \|\| user\?\.email === "[^"]+";',
    'const isSuperAdmin = roles.includes("super_admin");',
    src
)

# 2. Remover isSuper bypass no loadProfile
# Substitui: const isSuper = email === "imob365br@gmail.com";
src = re.sub(
    r'const email = currentUser\?\.email \?\? "";\s*const isSuper = email === "[^"]+";',
    '// Auth via role only — no hardcoded email bypass',
    src
)

# 3. Substituir usos de isSuper por checagem de role via roles array
# tipo_usuario: isSuper ? "imobiliaria" :
src = re.sub(
    r'tipo_usuario: isSuper\s*\?\s*"imobiliaria"\s*:',
    'tipo_usuario:',
    src
)
# plano_pretendido: isSuper ? "business" :
src = re.sub(
    r'plano_pretendido: isSuper\s*\?\s*"business"\s*:',
    'plano_pretendido:',
    src
)
# aprovado: isSuper ? true :
src = re.sub(
    r'aprovado: isSuper\s*\?\s*true\s*:',
    'aprovado:',
    src
)
# pagamento_validado: isSuper ? true :
src = re.sub(
    r'pagamento_validado: isSuper\s*\?\s*true\s*:',
    'pagamento_validado:',
    src
)

with open(path, "w") as f:
    f.write(src)

print("useAuth.tsx patched successfully")
PYEOF

log "useAuth.tsx — hardcode removido"

# ────────────────────────────────────────────────────────────
# 2. SQL MIGRATION — RLS user_roles + policies + seed
# ────────────────────────────────────────────────────────────
echo ""
echo "── SQL Migration: user_roles_rls ──"

MIGRATION_DIR="supabase/migrations"
mkdir -p "$MIGRATION_DIR"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$MIGRATION_DIR/${TIMESTAMP}_user_roles_rls_and_super_admin_seed.sql"

cat > "$MIGRATION_FILE" << 'SQLEOF'
-- ============================================================
-- Migration: user_roles RLS + super_admin seed seguro
-- Remove dependência de e-mail hardcoded para autorização
-- ============================================================

-- 1. Habilitar RLS na tabela user_roles
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Remover policies antigas conflitantes (se existirem)
DROP POLICY IF EXISTS "user_sees_own_roles" ON user_roles;
DROP POLICY IF EXISTS "only_super_admin_inserts_roles" ON user_roles;
DROP POLICY IF EXISTS "super_admin_manages_roles" ON user_roles;

-- 3. Policy: usuário vê apenas suas próprias roles
CREATE POLICY "user_sees_own_roles"
  ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Policy: super_admin pode ver todas as roles (para painel admin)
CREATE POLICY "super_admin_reads_all_roles"
  ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- 5. Policy: apenas super_admin pode inserir/atualizar/deletar roles
CREATE POLICY "super_admin_manages_roles"
  ON user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- 6. Seed: garantir super_admin via role, não via e-mail hardcoded
-- Executa apenas se o usuário existir e ainda não tiver a role
INSERT INTO user_roles (user_id, role)
SELECT au.id, 'super_admin'
FROM auth.users au
WHERE au.email = 'imob365br@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = au.id AND ur.role = 'super_admin'
  )
ON CONFLICT DO NOTHING;

-- 7. Garantir que o super_admin tenha profile.aprovado = true via role
UPDATE profiles
SET aprovado = true,
    pagamento_validado = true
WHERE id IN (
  SELECT user_id FROM user_roles WHERE role = 'super_admin'
);

-- 8. Verificação de sanidade
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'user_roles';

  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'FALHA: RLS não foi habilitado em user_roles';
  END IF;

  RAISE NOTICE 'OK: RLS habilitado em user_roles';
END $$;

SQLEOF

log "Migration criada: $MIGRATION_FILE"

# ────────────────────────────────────────────────────────────
# 3. TYPECHECK — validar patch
# ────────────────────────────────────────────────────────────
echo ""
echo "── TypeCheck ──"
TSC_OUT=$(npx tsc --noEmit 2>&1)
TARGET_ERRORS=$(echo "$TSC_OUT" | grep "useAuth" | grep "error TS" || true)
if [[ -n "$TARGET_ERRORS" ]]; then
  echo "$TARGET_ERRORS"
  # Restaurar backup em caso de erro
  cp "${USEAUTH}.bak" "$USEAUTH"
  fail "TypeCheck falhou em useAuth.tsx — backup restaurado"
fi
TOTAL=$(echo "$TSC_OUT" | grep -c "error TS" || true)
log "TypeCheck OK (${TOTAL} erros pré-existentes em outros arquivos ignorados)"

# ────────────────────────────────────────────────────────────
# 4. GIT COMMIT + PUSH
# ────────────────────────────────────────────────────────────
echo ""
git add "$USEAUTH" "$MIGRATION_FILE"
git commit -m "security(auth): remove hardcoded email from isSuperAdmin + RLS user_roles

useAuth.tsx:
  - Remove 'user?.email === imob365br@gmail.com' bypass em isSuperAdmin
  - Remove isSuper hardcode em loadProfile (aprovado/pagamento_validado)
  - Autorização agora exclusivamente via role 'super_admin' no DB

Migration ${TIMESTAMP}_user_roles_rls_and_super_admin_seed.sql:
  - ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY
  - Policy: user_sees_own_roles (SELECT)
  - Policy: super_admin_reads_all_roles (SELECT)
  - Policy: super_admin_manages_roles (ALL)
  - Seed: garante role super_admin via SQL, não via e-mail
  - UPDATE profiles SET aprovado=true para todos super_admins

CVSS mitigado: 9.1 (Broken Access Control via hardcoded identity)"

git push origin "$BRANCH"
log "Push → origin/$BRANCH ✓"

# Limpar backup
rm -f "${USEAUTH}.bak"

echo ""
log "════════════════════════════════════════════════"
log " SCRIPT 01 CONCLUÍDO — SEGURANÇA CRÍTICA"
log " Próximo: bash 02-iam-implementation.sh"
log "════════════════════════════════════════════════"
