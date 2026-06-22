#!/bin/bash
# fix-anon-key.sh
# Substitui TODOS os valores de anon/publishable key no .env pela nova chave ECC
# Uso: bash fix-anon-key.sh

set -e

PROJECT_ROOT="$HOME/imoB365---Google-AI-Studio"
ENV_FILE="$PROJECT_ROOT/.env"
CLIENT_TS="$PROJECT_ROOT/src/integrations/supabase/client.ts"

echo "══════════════════════════════════════════"
echo "  FIX: Legacy API keys are disabled"
echo "══════════════════════════════════════════"
echo ""
echo "A chave atual é um JWT legado (HS256) desabilitado."
echo "Você precisa da NOVA Publishable key (ECC/ES256)."
echo ""
echo "📍 Onde buscar no Supabase Dashboard:"
echo "   Settings → API Keys → aba 'Publishable and secret API keys'"
echo "   Seção 'Publishable key' → clique em Reveal → copie"
echo ""
echo "⚠️  NÃO use a aba 'Legacy anon, service_role API keys'"
echo ""

# Detecta a variável que o client.ts usa para anon key
ANON_VAR=$(grep -oE "import\.meta\.env\.[A-Z_]+" "$CLIENT_TS" \
  | grep -iE "ANON|PUBLISHABLE" \
  | grep -iv "SERVICE\|SECRET\|URL" \
  | head -1 \
  | sed 's/import\.meta\.env\.//')

echo "🔍 Variável detectada no client.ts: ${ANON_VAR:-VITE_SUPABASE_ANON_KEY}"
echo ""

echo -n "🔑 Cole a nova Publishable key e pressione Enter: "
read -r NEW_KEY

# Remove < > caso incluídos por engano
NEW_KEY="${NEW_KEY#<}"
NEW_KEY="${NEW_KEY%>}"
NEW_KEY="${NEW_KEY// /}"  # Remove espaços

echo ""

# Valida formato JWT
if [[ ! "$NEW_KEY" =~ ^eyJ ]]; then
  echo "❌ Formato inválido. A chave deve começar com 'eyJ'."
  exit 1
fi

# Detecta se ainda é HS256 (legado)
HEADER=$(echo "$NEW_KEY" | cut -d'.' -f1 | base64 -d 2>/dev/null || true)
if echo "$HEADER" | grep -q '"HS256"'; then
  echo "❌ Esta ainda é uma chave legada (HS256)."
  echo "   Acesse a aba 'Publishable and secret API keys' (não a Legacy)."
  exit 1
fi

echo "✅ Chave validada (formato ECC/novo)."
echo ""

# Backup
BACKUP="$ENV_FILE.bak.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "💾 Backup: $BACKUP"

# Atualiza TODAS as variáveis de anon/publishable key no .env
sed -i "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=${NEW_KEY}|" "$ENV_FILE"

# Atualiza a variável que o client.ts lê (pode ser VITE_SUPABASE_ANON_KEY)
if [ -n "$ANON_VAR" ] && [ "$ANON_VAR" != "VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  if grep -q "^${ANON_VAR}=" "$ENV_FILE"; then
    sed -i "s|^${ANON_VAR}=.*|${ANON_VAR}=${NEW_KEY}|" "$ENV_FILE"
  else
    echo "${ANON_VAR}=${NEW_KEY}" >> "$ENV_FILE"
  fi
  echo "✅ ${ANON_VAR} atualizada"
fi
echo "✅ VITE_SUPABASE_PUBLISHABLE_KEY atualizada"

echo ""
echo "🔎 Estado final das variáveis de anon key:"
grep -iE "ANON|PUBLISHABLE" "$ENV_FILE" \
  | awk -F'=' '{print $1 "=" substr($2,1,40)"..."}'
echo ""

# Reinicia o servidor
echo "🔄 Reiniciando servidor..."
for PORT in 5173 8082 3000 4173; do
  PID=$(lsof -ti:$PORT 2>/dev/null || true)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && echo "⏹️  Porta $PORT encerrada"
done

sleep 1
cd "$PROJECT_ROOT"
npm run dev &
sleep 4

PORT_ATIVA=$(ss -tlnp 2>/dev/null | grep -oE '(5173|8082|3000|4173)' | head -1)
echo ""
echo "══════════════════════════════════════════"
[ -n "$PORT_ATIVA" ] \
  && echo "  ✅ Servidor: http://localhost:$PORT_ATIVA" \
  || echo "  ✅ Servidor iniciado — verifique a porta no output acima"
echo "  Tente o login agora."
echo "══════════════════════════════════════════"
