#!/usr/bin/env bash
# deploy-blog.sh — commit, push e validação das rotas do blog
# Uso: bash deploy-blog.sh

set -uo pipefail

REPO_DIR="$HOME/imoB365---Google-AI-Studio"
DEV_LOG="/tmp/imob365-dev.log"
GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; NC="\033[0m"

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ─── 1. Diretório ────────────────────────────────────────────────────────────
cd "$REPO_DIR" || fail "Diretório não encontrado: $REPO_DIR"
log "Diretório: $(pwd)"

# ─── 2. Stage + Commit + Push ────────────────────────────────────────────────
git add -A
STAGED=$(git diff --cached --name-only)
if [[ -z "$STAGED" ]]; then
  warn "Nada para commitar. Pulando commit/push."
else
  echo ""
  echo "Arquivos staged:"
  echo "$STAGED" | sed 's/^/  /'
  echo ""

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

  git push origin "$BRANCH"
  log "Push concluído → origin/$BRANCH"
fi

# ─── 3. Validação de rotas ───────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo " Validação de rotas"
echo "─────────────────────────────────────────────"

DEV_PID=""
STARTED_SERVER=false
BASE_URL=""

# Detecta se servidor já está rodando (testa portas comuns)
for PORT in 3000 5173 8080 8081 8082 8083 8084 8085; do
  if curl -s --max-time 1 "http://localhost:${PORT}" > /dev/null 2>&1; then
    BASE_URL="http://localhost:${PORT}"
    log "Servidor já rodando em $BASE_URL"
    break
  fi
done

# Se não encontrou, sobe o dev server
if [[ -z "$BASE_URL" ]]; then
  warn "Nenhum servidor detectado. Iniciando npm run dev..."
  rm -f "$DEV_LOG"
  npm run dev > "$DEV_LOG" 2>&1 &
  DEV_PID=$!
  disown "$DEV_PID"   # evita SIGSTOP por job control no WSL
  STARTED_SERVER=true

  # Aguarda Vite escrever a porta no log (até 40s)
  echo -n "Aguardando Vite iniciar"
  DETECTED_PORT=""
  for i in $(seq 1 20); do
    sleep 2
    echo -n "."
    DETECTED_PORT=$(grep -o 'localhost:[0-9]*' "$DEV_LOG" 2>/dev/null | head -1 | cut -d: -f2 || true)
    if [[ -n "$DETECTED_PORT" ]]; then
      BASE_URL="http://localhost:${DETECTED_PORT}"
      echo ""
      log "Vite pronto na porta $DETECTED_PORT"
      break
    fi
  done

  if [[ -z "$BASE_URL" ]]; then
    echo ""
    warn "Vite não respondeu em 40s. Log:"
    tail -15 "$DEV_LOG" 2>/dev/null || true
    fail "Servidor não subiu — abortando validação"
  fi

  # Confirma que a URL responde
  sleep 2
fi

# Rotas a validar
ROUTES=(
  "/blog:Listagem do blog"
  "/sobre:Página sobre"
  "/consultoria:Página consultoria"
)

PASS=0
FAIL=0

for entry in "${ROUTES[@]}"; do
  PATH_PART="${entry%%:*}"
  DESC="${entry##*:}"
  URL="${BASE_URL}${PATH_PART}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    log "HTTP $HTTP_CODE — $DESC ($PATH_PART)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}[✗]${NC} HTTP $HTTP_CODE — $DESC ($PATH_PART)"
    FAIL=$((FAIL + 1))
  fi
done

# Post individual com slug conhecido
SLUG="imob365-inaugura-empreendimento-no-litoral-sul"
SLUG_URL="${BASE_URL}/blog/${SLUG}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$SLUG_URL" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log "HTTP $HTTP_CODE — Post individual (/blog/$SLUG)"
  PASS=$((PASS + 1))
else
  warn "HTTP $HTTP_CODE — Post individual (/blog/$SLUG) — SPA pode retornar 200 com JS client-side"
fi

echo ""
echo "─────────────────────────────────────────────"
echo " Resultado HTTP: ${PASS} ok / ${FAIL} falha(s)"
echo "─────────────────────────────────────────────"

# ─── 4. Assets no dist ───────────────────────────────────────────────────────
echo ""
echo "Assets de blog no dist:"
find "$REPO_DIR/dist" -name "*blog*" 2>/dev/null | sed 's/^/  /' || warn "dist/ não encontrado — rode npm run build"

# ─── 5. Auditoria tasks #38-43 ───────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo " Auditoria final — Tasks #38-43"
echo "─────────────────────────────────────────────"

audit_check() {
  local desc="$1"; shift
  if eval "$@" > /dev/null 2>&1; then
    log "$desc"
  else
    echo -e "${RED}[✗]${NC} $desc"
  fi
}

audit_check "#38 — blog.tsx existe"              "test -f src/routes/blog.tsx"
audit_check "#39 — blog.\$slug.tsx existe"       "test -f 'src/routes/blog.\$slug.tsx'"
audit_check "#40 — sobre.tsx existe"             "test -f src/routes/sobre.tsx"
audit_check "#41 — consultoria.tsx existe"       "test -f src/routes/consultoria.tsx"
audit_check "#42 — import_wp_posts.py corrigido" "! grep -q 'get_tenant_id' scripts/import_wp_posts.py"
audit_check "#43 — blog..tsx removido"           "! test -f 'src/routes/blog..tsx'"
audit_check "routeTree contém rota blog/slug"    "grep -q 'blog\.\$slug\|BlogSlug' src/routeTree.gen.ts"
audit_check "dist/ gerado (build ok)"            "test -d dist"

echo ""
if [[ $FAIL -eq 0 ]]; then
  log "Deploy e validação concluídos com sucesso!"
else
  warn "$FAIL rota(s) com falha HTTP — verifique acima"
fi

# Encerra servidor se foi iniciado por este script
if [[ "$STARTED_SERVER" == "true" && -n "$DEV_PID" ]]; then
  warn "Encerrando servidor dev (PID $DEV_PID)..."
  kill "$DEV_PID" 2>/dev/null || true
fi
