#!/bin/bash
# fix-env-keys.sh
# Atualiza VITE_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY no .env
# e reinicia o servidor de desenvolvimento.
# Uso: bash fix-env-keys.sh [/caminho/do/projeto]

set -e

# ─────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────
PROJECT_ROOT="${1:-$HOME/imoB365---Google-AI-Studio}"
ENV_FILE="$PROJECT_ROOT/.env"

# ─────────────────────────────────────────────
# VALIDAÇÕES
# ─────────────────────────────────────────────
echo "🔍 Validando ambiente..."

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Arquivo .env não encontrado em: $ENV_FILE"
  exit 1
fi

echo "✅ Projeto: $PROJECT_ROOT"
echo ""

# ─────────────────────────────────────────────
# LEITURA SEGURA DAS CHAVES (sem exibir no terminal)
# ─────────────────────────────────────────────
echo "📋 Onde buscar cada chave no Supabase Dashboard:"
echo "   Publishable key → Settings → API Keys → Publishable key → Reveal"
echo "   Secret key      → Settings → API Keys → Secret keys → Reveal"
echo ""
echo "⚠️  Cole as chaves SEM os caracteres < > ao redor."
echo ""

echo -n "🔑 Cole a nova PUBLISHABLE key (anon) e pressione Enter: "
read -r PUBLISHABLE_KEY
echo ""
echo -n "🔐 Cole a nova SECRET key (service_role) e pressione Enter: "
read -r SECRET_KEY
echo ""

# ─────────────────────────────────────────────
# VALIDAÇÃO DE FORMATO JWT
# ─────────────────────────────────────────────
validate_jwt() {
  local key="$1"
  local name="$2"

  # Remove < > caso o usuário tenha incluído por engano
  key="${key#<}"
  key="${key%>}"

  if [[ ! "$key" =~ ^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    echo "❌ Formato inválido para $name. Esperado: eyJ... (JWT com 3 partes separadas por ponto)"
    exit 1
  fi

  # Verifica se ainda é o JWT revogado (HS256 legado exposto)
  REVOKED_FRAGMENT="rqwljbqvyiyajvrdpzao.*c2VydmljZV9yb2xl"
  if echo "$key" | grep -qP "$REVOKED_FRAGMENT" 2>/dev/null || \
     [[ "$key" == *"4ipU5iXv65yHy26Z_iwSTUC35ZzuzdgGjabQPrx-Mmk"* ]]; then
    echo "❌ $name ainda é a chave REVOGADA. Copie a nova chave do Dashboard."
    exit 1
  fi

  echo "$key"
}

PUBLISHABLE_KEY=$(validate_jwt "$PUBLISHABLE_KEY" "Publishable key")
SECRET_KEY=$(validate_jwt "$SECRET_KEY" "Secret key")

# Garante que as chaves são diferentes entre si
if [ "$PUBLISHABLE_KEY" = "$SECRET_KEY" ]; then
  echo "❌ As duas chaves são idênticas. Publishable e Secret key devem ser valores diferentes."
  exit 1
fi

echo "✅ Formato das chaves validado."
echo ""

# ─────────────────────────────────────────────
# BACKUP DO .env ATUAL
# ─────────────────────────────────────────────
BACKUP="$ENV_FILE.bak.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "💾 Backup criado: $BACKUP"

# ─────────────────────────────────────────────
# ATUALIZAÇÃO DO .env
# ─────────────────────────────────────────────
sed -i "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY|" "$ENV_FILE"
sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SECRET_KEY|" "$ENV_FILE"

echo "✅ .env atualizado."
echo ""

# ─────────────────────────────────────────────
# VERIFICAÇÃO (exibe apenas os primeiros 20 chars de cada valor)
# ─────────────────────────────────────────────
echo "🔎 Verificação (primeiros 20 caracteres de cada variável):"
grep "VITE_SUPABASE_PUBLISHABLE_KEY\|SUPABASE_SERVICE_ROLE_KEY" "$ENV_FILE" \
  | awk -F'=' '{print $1 "=" substr($2,1,20) "..."}'
echo ""

# ─────────────────────────────────────────────
# REINÍCIO DO SERVIDOR DE DESENVOLVIMENTO
# ─────────────────────────────────────────────
read -rp "🚀 Reiniciar o servidor de desenvolvimento agora? (s/N): " RESTART
if [[ "$RESTART" =~ ^[sS]$ ]]; then
  echo ""
  echo "🔄 Reiniciando servidor..."
  cd "$PROJECT_ROOT"

  # Mata processo existente na porta 5173 (Vite padrão) se houver
  PID=$(lsof -ti:5173 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null && echo "⏹️  Servidor anterior encerrado (PID $PID)."
  fi

  npm run dev &
  sleep 3
  echo "✅ Servidor iniciado. Acesse: http://localhost:5173"
else
  echo "ℹ️  Reinicie manualmente com: cd $PROJECT_ROOT && npm run dev"
fi

echo ""
echo "─────────────────────────────────────────────"
echo "✅ Concluído. Teste o login no sistema."
echo "─────────────────────────────────────────────"
