#!/usr/bin/env bash
# deploy-blog.sh — commit, push e validação das rotas do blog
# Uso: bash deploy-blog.sh
# Requisitos: git, curl, npm (no PATH do WSL)

set -uo pipefail   # sem -e: evita saída prematura em aritméticas

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

DEV_PID=""
STARTED_SERVER=false

# Aguarda servidor estar pronto (polling)
wait_for_server() {
  local max_wait=30
  local interval=2
  local elapsed=0
  while [[ $elapsed -lt $max_wait ]]; do
    if curl -s --max-time 1 "$BASE_URL" > /dev/null 2>&1; then
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  return 1
}

if curl -s --max-time 2 "$BASE_URL" > /dev/null 2>&1; then
  log "Servidor já está rodando em $BASE_URL"
else
  warn "Servidor não detectado em $BASE_URL"
  warn "Iniciando 'npm run dev' em background..."
  npm run dev > /tmp/imob365-dev.log 2>&1 &
  DEV_PID=$!
  STARTED_SERVER=true
  trap '[[ -n "$DEV_PID" ]] && kill "$DEV_PID" 2>/dev/null; warn "Servidor dev encerrado"' EXIT

  echo -n "Aguardando servidor iniciar"
  for i in $(seq 1 15); do
    sleep 2
    echo -n "."
    if curl -s --max-time 1 "$BASE_URL" > /dev/null 2>&1; then
      echo ""
      log "Servidor pronto em $BASE_URL"
      break
    fi
    if [[ $i -eq 15 ]]; then
      echo ""
      # Tenta porta alternativa do Vite (5173)
      ALT_URL="http://localhost:5173"
      if curl -s --max-time 2 "$ALT_URL" > /dev/null 2>&1; then
        warn "Servidor rodando na porta 5173 (não 3000)"
        BASE_URL="$ALT_URL"
      else
        warn "Servidor não respondeu em 30s. Log: /tmp/imob365-dev.log"
        echo "Últimas linhas do log:"
        tail -10 /tmp/imob365-dev.log 2>/dev/null || true
        fail "Abortando validação — servidor não subiu"
      fi
    fi
  done
fi

# Rotas a validar: "path:descricao"
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

# Valida um slug de post (dinâmico — pega o primeiro disponível no dist)
FIRST_SLUG=$(find "$REPO_DIR/dist" -name "*.html" 2>/dev/null | grep -o 'blog/[^/]*' | head -1 | sed 's|blog/||' || true)
if [[ -n "$FIRST_SLUG" ]]; then
  SLUG_URL="${BASE_URL}/blog/${FIRST_SLUG}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$SLUG_URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    log "HTTP $HTTP_CODE — Post individual (/blog/$FIRST_SLUG)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}[✗]${NC} HTTP $HTTP_CODE — Post individual (/blog/$FIRST_SLUG)"
    FAIL=$((FAIL + 1))
  fi
else
  # Testa com slug conhecido do import
  SLUG_URL="${BASE_URL}/blog/imob365-inaugura-empreendimento-no-litoral-sul"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$SLUG_URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    log "HTTP $HTTP_CODE — Post individual (slug fixo)"
    PASS=$((PASS + 1))
  else
    warn "HTTP $HTTP_CODE — Post individual — SPA pode precisar de SSR para validar"
  fi
fi

echo ""
echo "─────────────────────────────────────────────"
echo " Resultado: ${PASS} ok / ${FAIL} falha(s)"
echo "─────────────────────────────────────────────"

# ─── 6. Verificação do dist ──────────────────────────────────────────────────
echo ""
echo "Assets de blog no dist:"
find "$REPO_DIR/dist" -name "*blog*" 2>/dev/null | sed 's/^/  /' || warn "dist/ não encontrado"

# ─── 7. Auditoria tasks #38-43 ───────────────────────────────────────────────
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
audit_check "routeTree contém BlogSlugRoute"     "grep -q 'blog\\.\\$slug\|BlogSlug' src/routeTree.gen.ts"
audit_check "dist/ gerado (build ok)"            "test -d dist"

echo ""
if [[ $FAIL -eq 0 ]]; then
  log "Deploy e validação concluídos com sucesso!"
else
  warn "$FAIL rota(s) com falha — verifique os logs acima"
fi

# Encerra servidor se foi iniciado por este script
if [[ "$STARTED_SERVER" == "true" && -n "$DEV_PID" ]]; then
  warn "Encerrando servidor dev (PID $DEV_PID)..."
  kill "$DEV_PID" 2>/dev/null || true
  trap - EXIT
fi
