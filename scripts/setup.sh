#!/bin/bash
# ============================================================
# imoB365 — Setup de configuração do Claude Code
# Execute uma vez na raiz do projeto
# ============================================================

PROJECT_DIR="$HOME/imoB365---Google-AI-Studio"

echo "📁 Acessando projeto: $PROJECT_DIR"
cd "$PROJECT_DIR" || { echo "❌ Projeto não encontrado em $PROJECT_DIR"; exit 1; }

# 1. Criar pasta .claude se não existir
mkdir -p .claude
echo "✅ Pasta .claude criada"

# 2. Copiar settings.json
cp "$(dirname "$0")/.claude/settings.json" .claude/settings.json
echo "✅ .claude/settings.json instalado"

# 3. Substituir CLAUDE.md com a versão atualizada
cp "$(dirname "$0")/CLAUDE.md" CLAUDE.md
echo "✅ CLAUDE.md atualizado"

# 4. Garantir que .claude/settings.local.json está no .gitignore
if ! grep -q "settings.local.json" .gitignore; then
  echo "" >> .gitignore
  echo "# Claude Code — config local nunca vai pro repo" >> .gitignore
  echo ".claude/settings.local.json" >> .gitignore
  echo "✅ .gitignore atualizado"
else
  echo "ℹ️  .gitignore já contém settings.local.json"
fi

# 5. Commitar configurações
echo ""
echo "📝 Commitando configurações..."
git add CLAUDE.md .claude/settings.json .gitignore
git commit -m "config: atualiza CLAUDE.md e settings do Claude Code"

echo ""
echo "🎉 Setup concluído! Rode 'claude' na pasta do projeto para iniciar."
