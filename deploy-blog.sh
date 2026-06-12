#!/usr/bin/env bash
# deploy-blog.sh — commit, push e validação das rotas do blog
# Uso: bash deploy-blog.sh
# Requisitos: git, curl, npm (no PATH do WSL)

set -euo pipefail

REPO_DIR="$HOME/imoB365---Google-AI-Studio"
DEV_PORT="${DEV_PORT:-3000}"
BASE_URL="http://localhost:${DEV_PORT}"
GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; NC="\033[0m"

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ─── 1. Diretório ────────────────────────────────────────────────────────────
cd "$REPO_DIR" || fail "Diretório não encontrado: $REPO_DIR"
log "Diretório: $(pwd)"

# ─── 2. Stage tudo ───────────────────────────────────────────────────────────
git add -A
STAGED=$(git diff --cached --name-only)
if [[ -z "$STAGED" ]]; then
  warn "Nada para commitar. Pulando commit/push."
else
  echo ""
  echo "Arquivos staged:"
  echo "$STAGED" | sed 's/^/  /'
  echo ""

  # ─── 3. Commit ─────────────────────────────────────────────────────────────
  BRANCH=$(git branch --show-current)
  git commit -m "feat(blog): migrate WordPress posts + public blog routes

- Add public /blog listing page with category filter chips
- Add /blog/:slug individual post page (dangerouslySetInnerHTML)
- Fix scripts/import_wp_posts.py: remove tenant_id (blog is public)
- Patch blog_posts schema: tenant_id nullable, bilingual status constraint
- Import 6 WordPress posts (wp_ids: 8764, 8767, 8769, 8771, 8773, 9033)
- Delete blog..tsx (pathless layout caused BlogRoute duplicate symbol)
- Regenerate src/routeTree.gen.ts (auto-generated, never edit manually)

Closes: #38 #39 #40 #41 #42 #43"
  log "Commit criado na branch '$BRANCH'"

  # ─── 4. Push ───────────────────────────────────────────────────────────────
  git push origin "$BRANCH"
  log "Push concluído → origin/$BRANCH"
fi

# ─── 5. Validação de rotas ───────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo " Validação de rotas"
echo "─────────────────────────────────────────────"

# Verifica se servidor já está rodando
if ! curl -s --max-time 2 "$BASE_URL" > /dev/null 2>&1; then
  warn "Servidor não detectado em $BASE_URL"
  warn "Iniciando 'npm run dev' em background (aguarde ~8s)..."
  npm run dev > /tmp/imob365-dev.log 2>&1 &
  DEV_PID=$!
  sleep 8
  # Garante kill ao sair
  trap "kill $DEV_PID 2>/dev/null; warn 'Servidor dev encerrado'" EXIT
else
  log "Servidor já está rodando em $BASE_URL"
  DEV_PID=""
fi

# Rotas a validar: "path:descricao"
ROUTES=(
  "/blog:Listagem do blog"
  "/blog/imob365-inaugura-empreendimento-no-litoral-sul:Post individual (slug)"
  "/sobre:Página sobre"
  "/consultoria:Página consultoria"
)

PASS=0; FAIL=0
for entry in "${ROUTES[@]}"; do
  PATH_PART="${entry%%:*}"
  DESC="${entry##*:}"
  URL="${BASE_URL}${PATH_PART}"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    log "HTTP $HTTP_CODE — $DESC ($PATH_PART)"
    ((PASS++))
  elif [[ "$HTTP_CODE" == "000" ]]; then
    fail "TIMEOUT — $DESC ($PATH_PART) — servidor não respondeu"
  else
    echo -e "${RED}[✗]${NC} HTTP $HTTP_CODE — $DESC ($PATH_PART)"
    ((FAIL++))
  fi
done

echo ""
echo "─────────────────────────────────────────────"
echo " Resultado: ${PASS} ok / ${FAIL} falha(s)"
echo "─────────────────────────────────────────────"

# ─── 6. Verificação do dist ──────────────────────────────────────────────────
echo ""
echo "Assets de blog no dist:"
find "$REPO_DIR/dist" -name "*blog*" 2>/dev/null | sed 's/^/  /' || warn "dist/ não encontrado (build necessário)"

# ─── 7. Resumo de tasks #38-43 ───────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo " Auditoria final — Tasks #38-43"
echo "─────────────────────────────────────────────"
check() {
  local desc="$1"; shift
  if eval "$@" > /dev/null 2>&1; then
    log "$desc"
  else
    echo -e "${RED}[✗]${NC} $desc"
  fi
}

check "#38 — blog.tsx existe"           "test -f src/routes/blog.tsx"
check "#39 — blog.\$slug.tsx existe"    "test -f 'src/routes/blog.\$slug.tsx'"
check "#40 — sobre.tsx existe"          "test -f src/routes/sobre.tsx"
check "#41 — consultoria.tsx existe"    "test -f src/routes/consultoria.tsx"
check "#42 — import_wp_posts.py corrigido (sem tenant_id hardcoded)" \
      "! grep -q 'get_tenant_id' scripts/import_wp_posts.py"
check "#43 — blog..tsx removido"        "! test -f 'src/routes/blog..tsx'"
check "blog_posts importados (routeTree contém BlogSlugRoute)" \
      "grep -q 'BlogSlugRoute\|blog\.\$slug' src/routeTree.gen.ts"

echo ""
[[ $FAIL -eq 0 ]] && log "Deploy e validação concluídos com sucesso!" \
                  || fail "$FAIL rota(s) retornaram erro — verifique os logs acima"
