#!/bin/bash
# deploy-expire-impulsionamentos.sh
# Cria a estrutura da Edge Function e faz o deploy com cron no Supabase
# Uso: bash deploy-expire-impulsionamentos.sh [/caminho/do/projeto]

set -e  # Para imediatamente se qualquer comando falhar

# ─────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────
FUNCTION_NAME="expire-impulsionamentos"
CRON_SCHEDULE="0 3 * * *"  # Diário às 03:00 UTC

# Caminho do projeto: usa o argumento passado ou o diretório atual
PROJECT_ROOT="${1:-$(pwd)}"
FUNCTION_DIR="$PROJECT_ROOT/supabase/functions/$FUNCTION_NAME"

# Caminho do arquivo gerado (ajuste se necessário)
SOURCE_FILE="$(dirname "$0")/expire-impulsionamentos.ts"

# ─────────────────────────────────────────────
# VALIDAÇÕES
# ─────────────────────────────────────────────
echo "🔍 Validando ambiente..."

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI não encontrado."
  echo "   Instale com: npm install -g supabase"
  exit 1
fi

# Verificar se o arquivo fonte existe
if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ Arquivo fonte não encontrado: $SOURCE_FILE"
  echo "   Certifique-se de que expire-impulsionamentos.ts está na mesma pasta que este script."
  exit 1
fi

# Verificar se o diretório do projeto tem supabase/config.toml
if [ ! -f "$PROJECT_ROOT/supabase/config.toml" ]; then
  echo "❌ supabase/config.toml não encontrado em: $PROJECT_ROOT"
  echo "   Execute este script a partir da raiz do projeto imoB365,"
  echo "   ou passe o caminho como argumento: bash deploy-expire-impulsionamentos.sh /caminho/do/projeto"
  exit 1
fi

echo "✅ Supabase CLI: $(supabase --version)"
echo "✅ Projeto:      $PROJECT_ROOT"
echo "✅ Função:       $FUNCTION_NAME"
echo "✅ Cron:         $CRON_SCHEDULE"
echo ""

# ─────────────────────────────────────────────
# PASSO 1: Criar diretório da função
# ─────────────────────────────────────────────
echo "📁 Criando diretório: $FUNCTION_DIR"
mkdir -p "$FUNCTION_DIR"

# ─────────────────────────────────────────────
# PASSO 2: Copiar o arquivo index.ts
# ─────────────────────────────────────────────
echo "📄 Copiando index.ts..."
cp "$SOURCE_FILE" "$FUNCTION_DIR/index.ts"
echo "✅ Arquivo copiado para: $FUNCTION_DIR/index.ts"
echo ""

# ─────────────────────────────────────────────
# PASSO 3: Limpar config.toml (remover schedule inválido se existir)
# CLI v2 não suporta 'schedule' em config.toml — cron será via pg_cron
# ─────────────────────────────────────────────
CONFIG_FILE="$PROJECT_ROOT/supabase/config.toml"

echo "⚙️  Verificando config.toml..."

# Remover bloco inválido que possa ter sido adicionado por versão anterior do script
sed -i "/^\[functions\.$FUNCTION_NAME\]/,/^$/{ /^schedule[[:space:]]*=/d }" "$CONFIG_FILE"

# Garantir que o bloco mínimo válido existe (sem schedule)
if grep -q "\[functions\.$FUNCTION_NAME\]" "$CONFIG_FILE"; then
  echo "ℹ️  Bloco [functions.$FUNCTION_NAME] já existe em config.toml."
else
  printf "\n[functions.%s]\nverify_jwt = true\n" "$FUNCTION_NAME" >> "$CONFIG_FILE"
  echo "✅ Bloco [functions.$FUNCTION_NAME] adicionado ao config.toml"
fi

echo ""

# ─────────────────────────────────────────────
# PASSO 4: Deploy da função
# ─────────────────────────────────────────────
echo "🚀 Iniciando deploy da função '$FUNCTION_NAME'..."
echo ""

cd "$PROJECT_ROOT"
supabase functions deploy "$FUNCTION_NAME"

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "─────────────────────────────────────────────"
echo "⏰ PRÓXIMO PASSO: Configurar o cron via pg_cron no Supabase SQL Editor"
echo ""
echo "Execute no SQL Editor do seu projeto Supabase:"
echo ""
echo "  SELECT cron.schedule("
echo "    'expire-impulsionamentos-daily',"
echo "    '$CRON_SCHEDULE',"
echo "    \$\$"
echo "      SELECT net.http_post("
echo "        url := 'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/$FUNCTION_NAME',"
echo "        headers := '{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer <SERVICE_ROLE_KEY>\"}'::jsonb,"
echo "        body := '{}'::jsonb"
echo "      );"
echo "    \$\$"
echo "  );"
echo ""
echo "Substitua <SEU_PROJECT_REF> e <SERVICE_ROLE_KEY> pelos valores do seu projeto."
echo "─────────────────────────────────────────────"
echo ""
echo "─────────────────────────────────────────────"
echo "Para testar manualmente:"
echo ""
echo "  curl -X POST https://<seu-projeto>.supabase.co/functions/v1/$FUNCTION_NAME \\"
echo "    -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\""
echo ""
echo "Para verificar os logs:"
echo "  supabase functions logs $FUNCTION_NAME"
echo "─────────────────────────────────────────────"
