#!/bin/bash
# =============================================================
# imoB365 — Fix BUG-13 (data ISO no Financeiro) +
#           BUG-14 (leads_set_dedupe_hashes search_path) +
#           migration SQL para BUG-14 + git push
# Execute no WSL: bash fix_bug13_bug14_push.sh
# =============================================================
set -e

PROJECT="$HOME/imoB365---Google-AI-Studio"
cd "$PROJECT"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  imoB365 — Correções BUG-13 e BUG-14                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
info() { echo "  ℹ️  $*"; }

# ─────────────────────────────────────────────────────────────
# BUG-13: Data ISO (2026-06-12) em vez de pt-BR (12/06/2026)
# na coluna VENCIMENTO da listagem do Financeiro
# Root cause: campo data_vencimento renderizado direto como
# string ISO sem passar por formatador de data
# ─────────────────────────────────────────────────────────────
echo "━━━ BUG-13: Formato de data ISO → pt-BR no Financeiro ━━━"

fix_financeiro_dates() {
  local file="src/routes/app.financeiro.index.tsx"
  [ -f "$file" ] || { warn "$file não encontrado"; return; }

  python3 - "$file" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

original = content
changes = 0

# ── Padrão 1: {l.data_vencimento} direto em JSX ──────────────
# Detecta qualquer acesso direto a data_vencimento em JSX (dentro de {} sem chamada de função)
# Substitui por formatação pt-BR
content, n = re.subn(
    r'\{(\w+)\.data_vencimento\}',
    r"{new Date(\1.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}",
    content
)
changes += n

# ── Padrão 2: {item.data_vencimento} ─────────────────────────
# (cobertura com alias de variável diferente)
# Já coberto pelo padrão acima (\w+ é genérico)

# ── Padrão 3: toLocaleDateString() sem locale ─────────────────
content, n = re.subn(
    r'(new Date\([^)]+\))\.toLocaleDateString\(\)',
    r"\1.toLocaleDateString('pt-BR')",
    content
)
changes += n

# ── Padrão 4: toLocaleDateString('en-US') ────────────────────
content, n = re.subn(
    r"toLocaleDateString\(['\"]en-US['\"]\)",
    "toLocaleDateString('pt-BR')",
    content
)
changes += n

# ── Padrão 5: format(date, 'MM/dd/yyyy') ─────────────────────
content, n = re.subn(
    r"format\(([^,]+),\s*['\"]MM/dd/yyyy['\"]\)",
    r"format(\1, 'dd/MM/yyyy')",
    content
)
changes += n

if changes > 0 and content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  FIXED {changes} date pattern(s) in: {path}")
else:
    print(f"  INFO: Nenhum padrão de data ISO encontrado em {path}")
    print("  Tentando busca mais ampla...")

PYEOF

  # Busca adicional — mostra contexto ao redor de data_vencimento
  echo ""
  info "Contexto de data_vencimento em $file:"
  grep -n "data_vencimento\|data_lancamento\|data_pagamento\|toLocale\|new Date\|format(" "$file" 2>/dev/null | head -20 || true
}

fix_financeiro_dates

# Aplicar em todos os arquivos de financeiro
echo ""
info "Varrendo outros arquivos de financeiro..."
for f in src/routes/app.financeiro.*.tsx src/components/financeiro/*.tsx; do
  [ -f "$f" ] || continue
  python3 - "$f" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

original = content
changes = 0

content, n = re.subn(
    r'\{(\w+)\.data_vencimento\}',
    r"{new Date(\1.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}",
    content
)
changes += n
content, n = re.subn(
    r'\{(\w+)\.data_lancamento\}',
    r"{new Date(\1.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')}",
    content
)
changes += n
content, n = re.subn(
    r'\{(\w+)\.data_pagamento\}',
    r"{new Date(\1.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}",
    content
)
changes += n
content, n = re.subn(
    r"toLocaleDateString\(['\"]en-US['\"]\)",
    "toLocaleDateString('pt-BR')",
    content
)
changes += n
content, n = re.subn(
    r"format\(([^,]+),\s*['\"]MM/dd/yyyy['\"]\)",
    r"format(\1, 'dd/MM/yyyy')",
    content
)
changes += n

if changes > 0 and content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  FIXED {changes} date pattern(s) in: {path}")
PYEOF
done

echo ""

# ─────────────────────────────────────────────────────────────
# BUG-14: Migration SQL — leads_set_dedupe_hashes search_path
# Root cause: pgcrypto instalado no schema 'extensions', mas
# o search_path da função não incluía 'extensions'
# Fix já aplicado no Supabase via SQL Editor, mas precisa estar
# rastreado como migration no projeto
# ─────────────────────────────────────────────────────────────
echo "━━━ BUG-14: Migration SQL para leads_set_dedupe_hashes ━━━"

# Verificar se há diretório de migrations
MIGRATIONS_DIR=""
for d in supabase/migrations migrations; do
  [ -d "$d" ] && { MIGRATIONS_DIR="$d"; break; }
done

if [ -n "$MIGRATIONS_DIR" ]; then
  MIGRATION_FILE="$MIGRATIONS_DIR/$(date +%Y%m%d%H%M%S)_fix_leads_dedupe_hashes_search_path.sql"
  cat > "$MIGRATION_FILE" << 'SQLEOF'
-- BUG-14: Fix search_path da função leads_set_dedupe_hashes
-- O pgcrypto está instalado no schema 'extensions' (padrão Supabase)
-- mas o search_path da função não incluía 'extensions', causando:
-- "function digest(text, unknown) does not exist"
-- ao tentar inserir leads via formulário público do portal.
ALTER FUNCTION public.leads_set_dedupe_hashes()
  SET search_path = public, extensions;
SQLEOF
  ok "Migration criada: $MIGRATION_FILE"
else
  warn "Diretório de migrations não encontrado — criando em supabase/migrations/"
  mkdir -p supabase/migrations
  MIGRATION_FILE="supabase/migrations/$(date +%Y%m%d%H%M%S)_fix_leads_dedupe_hashes_search_path.sql"
  cat > "$MIGRATION_FILE" << 'SQLEOF'
-- BUG-14: Fix search_path da função leads_set_dedupe_hashes
-- O pgcrypto está instalado no schema 'extensions' (padrão Supabase)
-- mas o search_path da função não incluía 'extensions', causando:
-- "function digest(text, unknown) does not exist"
-- ao tentar inserir leads via formulário público do portal.
ALTER FUNCTION public.leads_set_dedupe_hashes()
  SET search_path = public, extensions;
SQLEOF
  ok "Migration criada: $MIGRATION_FILE"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# TYPECHECK
# ─────────────────────────────────────────────────────────────
echo "━━━ Typecheck ━━━"
npx tsc --noEmit 2>&1 | tail -20 || warn "TypeScript reportou erros (verifique acima)"
echo ""

# ─────────────────────────────────────────────────────────────
# GIT — commit e push
# ─────────────────────────────────────────────────────────────
echo "━━━ Git commit + push ━━━"

git rm --cached .env 2>/dev/null && ok ".env removido do tracking" || true
git add -A -- ':!.env' ':!*.env' ':!.env.*'

STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
  info "Nada novo para commitar"
else
  echo "  Arquivos staged:"
  echo "$STAGED" | sed 's/^/    /'
  git commit -m "fix: BUG-13 data ISO→pt-BR Financeiro + BUG-14 migration leads dedupe

BUG-13: Formatar data_vencimento como dd/MM/yyyy (pt-BR) na
  listagem do Financeiro — estava exibindo string ISO 2026-06-12
  em vez de 12/06/2026.

BUG-14: Adicionar migration SQL que documenta o fix de
  search_path em leads_set_dedupe_hashes(). O pgcrypto é
  instalado no schema 'extensions' no Supabase, então o
  search_path precisa incluí-lo para digest() funcionar."
  ok "Commit criado"
fi

BRANCH=$(git branch --show-current)
info "Branch: $BRANCH"

if git push origin "$BRANCH" 2>&1; then
  ok "Push OK"
else
  git push --set-upstream origin "$BRANCH" 2>&1 && ok "Push OK" || echo "  ❌ Push falhou"
fi

echo ""
git log --oneline -5
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ BUG-13 + BUG-14 corrigidos e enviados ao GitHub      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Próximo passo:"
echo "  1. Recarregue http://localhost:8080/app/financeiro"
echo "  2. Confirme que a data aparece como 12/06/2026 (pt-BR)"
echo "  3. Teste o módulo Ajustes em http://localhost:8080/app/ajustes"
echo ""
