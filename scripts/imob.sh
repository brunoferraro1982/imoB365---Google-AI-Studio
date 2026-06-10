#!/bin/bash
# ============================================================
# imoB365 — Script Mestre de Automação Local
# Uso: bash scripts/imob.sh [comando] [opções]
# ============================================================

set -euo pipefail

PROJECT="$HOME/imoB365---Google-AI-Studio"
MAIN_BRANCH="main"
DEV_BRANCH="develop"
SCRIPTS_DIR="$PROJECT/scripts"

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[imob]${NC} $*"; }
success() { echo -e "${GREEN}[✅]${NC} $*"; }
warn()    { echo -e "${YELLOW}[⚠️ ]${NC} $*"; }
error()   { echo -e "${RED}[❌]${NC} $*"; exit 1; }
title()   { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}\n"; }

cd "$PROJECT" || error "Projeto não encontrado em $PROJECT"

# ════════════════════════════════════════════════════════════
# COMANDO: setup — configura o ambiente do projeto
# ════════════════════════════════════════════════════════════
cmd_setup() {
  title "SETUP DO AMBIENTE"

  # Node / npm
  command -v node &>/dev/null || error "Node.js não encontrado. Instale via nvm."
  NODE_VER=$(node --version)
  log "Node: $NODE_VER"

  # Dependências
  log "Instalando dependências..."
  npm ci --silent
  success "node_modules OK"

  # .env
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example .env
      warn ".env criado a partir de .env.example — preencha as variáveis"
    else
      touch .env
      warn ".env criado vazio — preencha as variáveis necessárias"
    fi
  else
    success ".env já existe"
  fi

  # .claude/settings.json
  mkdir -p .claude
  if [ ! -f ".claude/settings.json" ]; then
    warn ".claude/settings.json não encontrado — rode: bash scripts/setup.sh"
  else
    success ".claude/settings.json OK"
  fi

  # CLAUDE.md
  [ -f "CLAUDE.md" ] && success "CLAUDE.md OK" || warn "CLAUDE.md não encontrado"

  success "Setup concluído!"
}

# ════════════════════════════════════════════════════════════
# COMANDO: feature — cria e gerencia branches de feature
# Uso: imob.sh feature start nome-da-feature
#      imob.sh feature finish nome-da-feature
# ════════════════════════════════════════════════════════════
cmd_feature() {
  local action="${1:-}" name="${2:-}"
  [ -z "$action" ] && error "Uso: imob.sh feature [start|finish] nome-da-feature"
  [ -z "$name"   ] && error "Informe o nome da feature"

  BRANCH="feature/$name"

  case "$action" in
    start)
      title "INICIANDO FEATURE: $name"
      git checkout "$DEV_BRANCH"
      git pull origin "$DEV_BRANCH"
      git checkout -b "$BRANCH"
      success "Branch criada: $BRANCH"
      log "Agora trabalhe na feature e rode: imob.sh feature finish $name"
      ;;

    finish)
      title "FINALIZANDO FEATURE: $name"
      # Garantir que estamos na branch certa
      CURRENT=$(git branch --show-current)
      [ "$CURRENT" != "$BRANCH" ] && git checkout "$BRANCH"

      # Lint antes do merge
      log "Rodando lint..."
      npm run lint || error "Lint falhou — corrija os erros antes de finalizar"
      success "Lint OK"

      # Build de verificação
      log "Verificando build..."
      npm run build --silent || error "Build falhou — corrija antes de finalizar"
      success "Build OK"

      # Merge na develop
      git checkout "$DEV_BRANCH"
      git pull origin "$DEV_BRANCH"
      git merge --no-ff "$BRANCH" -m "feat: merge $BRANCH → $DEV_BRANCH"
      git push origin "$DEV_BRANCH"
      git branch -d "$BRANCH"
      git push origin --delete "$BRANCH" 2>/dev/null || true

      success "Feature '$name' finalizada e merged em $DEV_BRANCH!"
      ;;

    *)
      error "Ação inválida: $action. Use 'start' ou 'finish'"
      ;;
  esac
}

# ════════════════════════════════════════════════════════════
# COMANDO: fix — cria branch de bugfix
# Uso: imob.sh fix start qa-01-timezone
#      imob.sh fix finish qa-01-timezone
# ════════════════════════════════════════════════════════════
cmd_fix() {
  local action="${1:-}" name="${2:-}"
  [ -z "$action" ] && error "Uso: imob.sh fix [start|finish] nome-do-fix"
  [ -z "$name"   ] && error "Informe o nome do fix"

  BRANCH="fix/$name"

  case "$action" in
    start)
      title "INICIANDO FIX: $name"
      git checkout "$DEV_BRANCH"
      git pull origin "$DEV_BRANCH"
      git checkout -b "$BRANCH"
      success "Branch de fix criada: $BRANCH"
      ;;

    finish)
      title "FINALIZANDO FIX: $name"
      CURRENT=$(git branch --show-current)
      [ "$CURRENT" != "$BRANCH" ] && git checkout "$BRANCH"

      npm run lint || error "Lint falhou"
      success "Lint OK"

      git checkout "$DEV_BRANCH"
      git pull origin "$DEV_BRANCH"
      git merge --no-ff "$BRANCH" -m "fix: merge $BRANCH → $DEV_BRANCH"
      git push origin "$DEV_BRANCH"
      git branch -d "$BRANCH"
      git push origin --delete "$BRANCH" 2>/dev/null || true

      success "Fix '$name' finalizado e merged em $DEV_BRANCH!"
      ;;

    *)
      error "Ação inválida: $action. Use 'start' ou 'finish'"
      ;;
  esac
}

# ════════════════════════════════════════════════════════════
# COMANDO: release — promove develop → main com tag
# Uso: imob.sh release 1.2.0
# ════════════════════════════════════════════════════════════
cmd_release() {
  local version="${1:-}"
  [ -z "$version" ] && error "Uso: imob.sh release 1.2.0"

  title "RELEASE v$version"

  # Verificar branch atual
  git checkout "$DEV_BRANCH"
  git pull origin "$DEV_BRANCH"

  # Lint + build obrigatórios
  log "Lint..."
  npm run lint || error "Lint falhou — não é possível fazer release"
  success "Lint OK"

  log "Build de produção..."
  npm run build || error "Build falhou — não é possível fazer release"
  success "Build OK"

  # Merge develop → main
  git checkout "$MAIN_BRANCH"
  git pull origin "$MAIN_BRANCH"
  git merge --no-ff "$DEV_BRANCH" -m "release: v$version"

  # Tag
  git tag -a "v$version" -m "Release v$version"

  # Push tudo
  git push origin "$MAIN_BRANCH"
  git push origin "v$version"

  # Voltar para develop
  git checkout "$DEV_BRANCH"

  success "Release v$version publicada em $MAIN_BRANCH!"
  log "GitHub Actions vai iniciar o pipeline de CI/CD automaticamente."
}

# ════════════════════════════════════════════════════════════
# COMANDO: qa — executa os fixes QA automaticamente
# Uso: imob.sh qa [--commit]
# ════════════════════════════════════════════════════════════
cmd_qa() {
  local auto_commit="${1:-}"
  title "EXECUÇÃO DE FIXES QA"

  if [ ! -f "$SCRIPTS_DIR/qa-fixes.sh" ]; then
    error "qa-fixes.sh não encontrado em $SCRIPTS_DIR"
  fi

  if [ "$auto_commit" = "--commit" ]; then
    # Modificar temporariamente para auto-confirmar
    CONFIRM=s bash "$SCRIPTS_DIR/qa-fixes.sh"
  else
    bash "$SCRIPTS_DIR/qa-fixes.sh"
  fi
}

# ════════════════════════════════════════════════════════════
# COMANDO: sync — sincroniza todas as branches com o remote
# ════════════════════════════════════════════════════════════
cmd_sync() {
  title "SINCRONIZANDO COM GITHUB"

  git fetch --all --prune
  
  git checkout "$MAIN_BRANCH"
  git pull origin "$MAIN_BRANCH"
  success "$MAIN_BRANCH atualizado"

  git checkout "$DEV_BRANCH"
  git pull origin "$DEV_BRANCH"
  success "$DEV_BRANCH atualizado"

  log "Branches remotas:"
  git branch -r
}

# ════════════════════════════════════════════════════════════
# COMANDO: status — visão geral do projeto
# ════════════════════════════════════════════════════════════
cmd_status() {
  title "STATUS DO PROJETO imoB365"

  echo -e "${BOLD}Branch atual:${NC}    $(git branch --show-current)"
  echo -e "${BOLD}Último commit:${NC}   $(git log --oneline -1)"
  echo -e "${BOLD}Status:${NC}"
  git status --short

  echo ""
  echo -e "${BOLD}Branches locais:${NC}"
  git branch -v

  echo ""
  echo -e "${BOLD}Tags:${NC}"
  git tag --sort=-v:refname | head -5 || echo "  (nenhuma)"

  echo ""
  echo -e "${BOLD}Divergência com remote:${NC}"
  git log --oneline origin/"$DEV_BRANCH"..HEAD 2>/dev/null | head -5 \
    || echo "  (em sincronia)"
}

# ════════════════════════════════════════════════════════════
# COMANDO: commit — commit rápido com mensagem padronizada
# Uso: imob.sh commit "feat: adiciona simulador de financiamento"
# ════════════════════════════════════════════════════════════
cmd_commit() {
  local msg="${1:-}"
  [ -z "$msg" ] && error "Uso: imob.sh commit \"tipo: mensagem em PT-BR\""

  # Validar prefixo convencional
  if ! echo "$msg" | grep -qE "^(feat|fix|chore|docs|refactor|style|test|ci|config):"; then
    warn "Prefixo não convencional. Use: feat|fix|chore|docs|refactor|style|test|ci|config"
    read -p "Continuar mesmo assim? (s/n): " ok
    [[ "$ok" != "s" ]] && exit 0
  fi

  git add -A
  git status --short
  echo ""
  read -p "Commitar com a mensagem: \"$msg\"? (s/n): " confirm
  [[ "$confirm" != "s" ]] && { log "Cancelado."; exit 0; }

  git commit -m "$msg"
  success "Commit realizado: $msg"

  read -p "Fazer push agora? (s/n): " push
  if [[ "$push" == "s" ]]; then
    BRANCH=$(git branch --show-current)
    git push origin "$BRANCH"
    success "Push para origin/$BRANCH realizado!"
  fi
}

# ════════════════════════════════════════════════════════════
# MENU DE AJUDA
# ════════════════════════════════════════════════════════════
cmd_help() {
  echo -e "${BOLD}${CYAN}"
  echo "  imoB365 — Script Mestre de Automação"
  echo -e "${NC}"
  echo -e "  ${BOLD}Uso:${NC} bash scripts/imob.sh [comando] [opções]"
  echo ""
  echo -e "  ${BOLD}Comandos disponíveis:${NC}"
  echo ""
  echo -e "  ${GREEN}setup${NC}                        Configura o ambiente (deps, .env, CLAUDE.md)"
  echo -e "  ${GREEN}status${NC}                       Visão geral do projeto e git"
  echo -e "  ${GREEN}sync${NC}                         Sincroniza branches com o GitHub"
  echo ""
  echo -e "  ${GREEN}feature start${NC} <nome>         Cria branch feature/<nome>"
  echo -e "  ${GREEN}feature finish${NC} <nome>        Lint + build + merge na develop"
  echo ""
  echo -e "  ${GREEN}fix start${NC} <nome>             Cria branch fix/<nome>"
  echo -e "  ${GREEN}fix finish${NC} <nome>            Lint + merge na develop"
  echo ""
  echo -e "  ${GREEN}commit${NC} \"tipo: mensagem\"      Commit padronizado com push opcional"
  echo ""
  echo -e "  ${GREEN}qa${NC}                           Executa fixes QA interativamente"
  echo -e "  ${GREEN}qa --commit${NC}                  Executa fixes QA e commita automaticamente"
  echo ""
  echo -e "  ${GREEN}release${NC} <versão>             Lint + build + merge main + tag + push"
  echo ""
  echo -e "  ${BOLD}Exemplos:${NC}"
  echo "  bash scripts/imob.sh feature start simulador-financiamento"
  echo "  bash scripts/imob.sh commit \"feat: adiciona filtro por bairro\""
  echo "  bash scripts/imob.sh release 1.1.0"
  echo ""
}

# ════════════════════════════════════════════════════════════
# ROTEADOR DE COMANDOS
# ════════════════════════════════════════════════════════════
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  setup)   cmd_setup "$@" ;;
  feature) cmd_feature "$@" ;;
  fix)     cmd_fix "$@" ;;
  release) cmd_release "$@" ;;
  qa)      cmd_qa "$@" ;;
  sync)    cmd_sync "$@" ;;
  status)  cmd_status "$@" ;;
  commit)  cmd_commit "$@" ;;
  help|--help|-h) cmd_help ;;
  *) error "Comando desconhecido: $COMMAND. Use 'help' para ver os comandos." ;;
esac
