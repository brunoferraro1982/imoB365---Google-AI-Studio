#!/bin/bash
# fix-api-key.sh
# Diagnostica e corrige o erro "Invalid API key" no imoB365
# Uso: bash fix-api-key.sh

set -e

PROJECT_ROOT="$HOME/imoB365---Google-AI-Studio"
ENV_FILE="$PROJECT_ROOT/.env"
CLIENT_TS="$PROJECT_ROOT/src/integrations/supabase/client.ts"

echo "══════════════════════════════════════════"
echo "  DIAGNÓSTICO: Invalid API key — imoB365"
echo "══════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────
# PASSO 1: Descobrir qual variável o client.ts lê
# ─────────────────────────────────────────────
echo "📄 Variáveis lidas pelo client.ts:"
grep -oE "import\.meta\.env\.[A-Z_]+" "$CLIENT_TS" | sort -u
echo ""

# Extrai o nome da variável de anon key usada no código
ANON_VAR=$(grep -oE "import\.meta\.env\.[A-Z_]+" "$CLIENT_TS" \
  | grep -iE "ANON|PUBLISHABLE|KEY" \
  | grep -iv "SERVICE\|SECRET\|URL" \
  | head -1 \
  | sed 's/import\.meta\.env\.//')

echo "🔑 Variável de anon key detectada no código: $ANON_VAR"
echo ""

# ─────────────────────────────────────────────
# PASSO 2: Verificar se essa variável existe no .env
# ─────────────────────────────────────────────
echo "📋 Estado atual do .env (variáveis Supabase):"
grep -i "supabase" "$ENV_FILE" | awk -F'=' '{print $1 "=" substr($2,1,30)"..."}'
echo ""

if grep -q "^${ANON_VAR}=" "$ENV_FILE"; then
  CURRENT_VAL=$(grep "^${ANON_VAR}=" "$ENV_FILE" | cut -d'=' -f2-)
  if [[ -z "$CURRENT_VAL" || "$CURRENT_VAL" == "<"* ]]; then
    echo "❌ $ANON_VAR existe mas está vazia ou com formato inválido (<...>)"
    NEED_FIX=true
  else
    echo "✅ $ANON_VAR está definida no .env"
    NEED_FIX=false
  fi
else
  echo "❌ $ANON_VAR NÃO existe no .env — essa é a causa do erro"
  NEED_FIX=true
fi

echo ""

# ─────────────────────────────────────────────
# PASSO 3: Tentar obter o valor de outra variável existente
# ─────────────────────────────────────────────
if [ "$NEED_FIX" = true ]; then
  # Busca a publishable key já salva no .env
  PUBLISHABLE_VAL=$(grep -E "^VITE_SUPABASE_PUBLISHABLE_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '<>')

  if [[ -n "$PUBLISHABLE_VAL" && "$PUBLISHABLE_VAL" =~ ^eyJ ]]; then
    echo "🔄 Encontrado valor válido em VITE_SUPABASE_PUBLISHABLE_KEY"
    echo "   Aplicando como alias para $ANON_VAR..."
    echo ""

    # Backup
    BACKUP="$ENV_FILE.bak.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP"
    echo "💾 Backup: $BACKUP"

    if grep -q "^${ANON_VAR}=" "$ENV_FILE"; then
      # Atualiza linha existente
      sed -i "s|^${ANON_VAR}=.*|${ANON_VAR}=${PUBLISHABLE_VAL}|" "$ENV_FILE"
    else
      # Adiciona nova linha após VITE_SUPABASE_PUBLISHABLE_KEY
      sed -i "/^VITE_SUPABASE_PUBLISHABLE_KEY=/a ${ANON_VAR}=${PUBLISHABLE_VAL}" "$ENV_FILE"
    fi

    echo "✅ $ANON_VAR definida com sucesso"
  else
    echo "⚠️  Nenhum valor válido encontrado para reutilizar."
    echo "   Execute o script fix-env-keys.sh para inserir as chaves manualmente."
    exit 1
  fi
fi

echo ""

# ─────────────────────────────────────────────
# PASSO 4: Verificação final
# ─────────────────────────────────────────────
echo "🔎 Verificação final do .env:"
grep -i "supabase.*key\|supabase.*publishable\|supabase.*anon" "$ENV_FILE" \
  | awk -F'=' '{print $1 "=" substr($2,1,30)"..."}'
echo ""

# ─────────────────────────────────────────────
# PASSO 5: Reiniciar o servidor
# ─────────────────────────────────────────────
echo "🔄 Reiniciando servidor de desenvolvimento..."

# Mata processos nas portas comuns do Vite
for PORT in 5173 8082 3000 4173; do
  PID=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null
    echo "⏹️  Processo encerrado na porta $PORT (PID $PID)"
  fi
done

sleep 1
cd "$PROJECT_ROOT"
npm run dev &
sleep 4

# Detecta a porta que subiu
PORT_ATIVA=$(ss -tlnp 2>/dev/null | grep -oE ':(5173|8082|3000|4173)' | head -1 | tr -d ':')
if [ -n "$PORT_ATIVA" ]; then
  echo ""
  echo "✅ Servidor rodando em: http://localhost:$PORT_ATIVA"
else
  echo ""
  echo "ℹ️  Servidor iniciado. Verifique a URL no output do npm run dev."
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Tente fazer login agora no sistema."
echo "══════════════════════════════════════════"
