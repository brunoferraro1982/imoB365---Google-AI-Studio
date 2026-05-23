
# Revisão QA — Fases 1 a 4

Revisei todas as funções implementadas nas últimas fases (favoritos, buscas salvas, comparador, alertas, simulador, histórico de preços, agendamento de visitas, notificações, área `/conta`). Abaixo está o roadmap de correções classificadas por severidade. Quando você liberar créditos, executo tudo na ordem listada.

## 🔴 Críticos (segurança / bugs que quebram fluxo do usuário)

**1. Endpoint cron de visitas sem autenticação**
`src/routes/api.public.cron.visitas-notificacoes.ts` aceita `POST` público sem header `apikey`. Qualquer pessoa pode disparar envios de e-mail. O endpoint de buscas-alertas já valida — replicar o mesmo padrão (checar `apikey` contra `SUPABASE_PUBLISHABLE_KEY`).

**2. Histórico de preço invisível para visitantes anônimos**
`imovel_historico` tem RLS que só permite leitura por membros do tenant. Em `/imovel/$slug` (página pública), `HistoricoPreco` sempre renderiza vazio para quem não está logado no tenant. Corrigir criando RPC `SECURITY DEFINER` `public_historico_preco(imovel_id)` que retorna apenas variações de preço de imóveis publicados/ativos.

**3. Reset de senha aponta para rota inexistente**
`conta.perfil.tsx` chama `resetPasswordForEmail` com `redirectTo: /reset-password`, mas o arquivo `src/routes/reset-password.tsx` não existe → 404 ao clicar no e-mail. Criar a rota com formulário de nova senha (`supabase.auth.updateUser({ password })`).

**4. Cache de favoritos não invalida em logout/troca de usuário**
`FavoritoButton.tsx` mantém `cachedIds` em módulo-level. Quando o usuário faz logout e outro faz login, o coração aparece preenchido errado. Também, ao remover favorito em `/conta/favoritos`, o cache não é atualizado. Solução: resetar cache quando `user?.id` muda e expor função `invalidate()` chamada por `conta.favoritos`.

## 🟡 Importantes (UX / consistência de dados)

**5. `ImoveisSimilares` usa `eq("endereco_cidade", cidade)` case-sensitive**
Pequenas variações ("São Paulo" vs "sao paulo") quebram o match. Trocar por `ilike` ou normalizar no insert.

**6. Cron de alertas usa origin da requisição como URL do site**
`buscas-alertas` constrói links com `new URL(request.url).origin` → quando pg_cron chama o sandbox, e-mails saem com domínio temporário. Usar `process.env.SITE_URL` como `visitas-notificacoes` já faz, com fallback para origin.

**7. `AgendarVisita` aceita e-mail sem validar formato**
Campo é `type="email"` no HTML mas, no submit, só valida `trim().length`. Pessoa pode enviar "abc" e a fila tentará entregar. Adicionar regex simples e bloquear envio.

**8. Sem proteção contra spam em `public_solicitar_visita`**
Mesmo e-mail/telefone pode agendar N visitas seguidas. Adicionar rate-limit no RPC (máx. 3 visitas pendentes por e-mail nas últimas 24h).

## 🟢 Polimento

**9. `SimuladorFinanciamento` não trava valores extremos**
Input de prazo aceita 0/negativos (a função guarda contra divisão, mas a UI fica estranha). Forçar `clamp` no `onChange`.

**10. Janela de lembrete (22h–26h) pode pular agendamentos do mesmo dia**
Visita criada com <22h de antecedência nunca recebe lembrete. Aceitável, mas pode-se acionar lembrete imediato no `public_solicitar_visita` quando `data_hora - now() < 24h`.

**11. `conta.index` Card usa `to: string` com `as any`**
Perde type-safety dos links. Tipar como `LinkProps["to"]`.

---

## Plano de execução (quando os créditos liberarem)

```text
Etapa 1 — Segurança
  1.1 Adicionar auth ao cron de visitas-notificacoes
  1.2 Criar rota /reset-password com formulário de nova senha
  1.3 Rate-limit no RPC public_solicitar_visita

Etapa 2 — Dados públicos
  2.1 Migration: RPC public_historico_preco + ajustar HistoricoPreco
  2.2 Migration: índice e normalização em ImoveisSimilares (ilike)

Etapa 3 — Estado do cliente
  3.1 Refatorar FavoritoButton para invalidar cache no logout
  3.2 Sincronizar /conta/favoritos com o cache compartilhado

Etapa 4 — Polimento
  4.1 SITE_URL em buscas-alertas
  4.2 Validação de e-mail em AgendarVisita
  4.3 Clamp de inputs no SimuladorFinanciamento
  4.4 Type-safety de links em conta.index
  4.5 Lembrete imediato para visitas < 24h
```

### Detalhes técnicos relevantes
- Migrations necessárias: 1 nova RPC `public_historico_preco`, 1 nova RPC ou ajuste em `public_solicitar_visita` para rate-limit. Sem mudanças destrutivas em tabelas.
- Sem novas dependências npm.
- Estimativa: ~9 arquivos editados, 2 criados (`reset-password.tsx` + migração), 1 RPC nova.

Posso executar este roadmap assim que você liberar créditos?
