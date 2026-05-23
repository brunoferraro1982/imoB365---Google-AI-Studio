# 📋 Plano de QA & Roadmap de Correções — imob365

Este documento apresenta uma análise profissional de Quality Assurance (QA) sobre a base de código do projeto **imob365 / Imóvel Conectado**, identificando pontos críticos de falha, vulnerabilidades de segurança e inconsistências de interface com o usuário (UX). Estão listados abaixo os 4 erros de alta prioridade diagnosticados, acompanhados de impacto, causa raiz e ações necessárias no roadmap de execução.

---

## 🛠️ Roadmap de Itens a Serem Executados (Prioridade de Correção)

| ID | Item de Correção | Módulo | Severidade | Impacto no Usuário / Negócio |
| :--- | :--- | :--- | :--- | :--- |
| **QA-01** | **Shift de fuso horário no calendário de visitas** | `app.visitas` | **ALTA** | Visitas agendadas após as 21:00 (UTC-3) aparecem no dia seguinte para os corretores, causando perda de compromissos. |
| **QA-02** | **Tela de fotos estática após alterar thumbnail (capa)** | `FotosManager` | **ALTA** | O corretor marca uma foto como capa, o banco de dados atualiza mas a interface não altera a estrela ou badge de capa devido ao bloqueio de sync. |
| **QA-03** | **Falha de bypass em autenticação de Cron Job** | `cron.buscas-alertas` | **MÉDIA-ALTA** | Se as credenciais do Supabase não estiverem populadas em produção, requisições vazias executam o fluxo de e-mail e disparam créditos transacionais. |
| **QA-04** | **Redirecionamento prematuro (race condition) de Super Admin** | `useAuth` | **MÉDIA** | Super administradores ao acessar `/admin` são ejetados para `/app` se a consulta ao perfil demorar mais que a da sessão principal. |

---

## 🔍 Detalhamento Técnico das Inconsistências Identificadas

### 🔴 QA-01: Shift de Fuso Horário em Calendário Interativo
* **Arquivo relacionado:** `src/routes/app.visitas.tsx` (linhas 41-45)
* **Status:** Pendente de Correção
* **Causa Raiz:** O bloco de mapeamento dos eventos no calendário faz uso de formatadores globais em UTC:
  ```typescript
  const k = new Date(v.data_hora).toISOString().slice(0, 10);
  ```
  Isolando o fuso em `.toISOString()`, um agendamento efetuado localmente em São Paulo às 22:00 do dia `2026-05-22` vira `2026-05-23 01:00:00 UTC`, jogando erroneamente a visualização da visita para o dia seguinte no calendário.
* **Ação Executável:** Substituir por um construtor de string com os getters locais do objeto `Date` no fuso do navegador do corretor:
  ```typescript
  const d = new Date(v.data_hora);
  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  ```

---

### 🔴 QA-02: Filtro de Sincronização Estolado em Gerenciamento de Imagens
* **Arquivo relacionado:** `src/components/imoveis/FotosManager.tsx` (linha 50)
* **Status:** Pendente de Correção
* **Causa Raiz:** A fim de sincronizar a lista de uploads no painel, o componente implementa a seguinte condição de renderização:
  ```typescript
  if (items !== fotos && items.length !== fotos.length) setItems(fotos);
  ```
  Ao atualizar a foto de **Capa** (thumbnail), a lista de fotos sofre uma alteração interna mas preserva rigorosamente o mesmo tamanho do array (`items.length === fotos.length`), fazendo com que o state de fotos `items` não se atualize com os novos dados do backend. O corretor clica em definir capa mas a tela continua idêntica.
* **Ação Executável:** Alterar a sincronização de estado substituindo a validação de quantidade por uma verificação profunda de chaves do array ou gerenciando diretamente no hook de efeitos (`useEffect` direcionado por dependência exata de metadados).

---

### 🟡 QA-03: Falha Estrutural de Autenticação Anon Key Sem Valor (Bypass)
* **Arquivos relacionados:** `src/routes/api.public.cron.buscas-alertas.ts` e `api.public.cron.visitas-notificacoes.ts`
* **Status:** Pendente de Correção
* **Causa Raiz:** Para proteger os endpoints públicos expostos de processamento em batch, o validador compara:
  ```typescript
  const apikey = request.headers.get("apikey") ?? "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!expected || apikey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  ```
  Se o servidor estiver sem chaves (variáveis de ambiente vazias, comuns em inicialização inicial, builds locais ou contâineres não configurados), a variável `expected` vira `""` e contorna a instrução `if (!expected)`. Com isso, qualquer requisição web com o header `apikey` vazio será considerada autorizada!
* **Ação Executável:** Blindar a comparação para que falhe imediatamente se os segredos de ambiente forem nulos ou vazios:
  ```typescript
  if (!expected || expected === "" || apikey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  ```

---

### 🟡 QA-04: Corrida de Status (Race Condition) no Carregamento de Atribuição (Roles)
* **Arquivo relacionado:** `src/hooks/useAuth.tsx` (linhas 38-46)
* **Status:** Pendente de Correção
* **Causa Raiz:** O hook de escopo `useAuth` executa de maneira assíncrona o carregamento dos privilégios de super admin:
  ```typescript
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      loadRoles(s.user.id);
      loadProfile(s.user.id);
    }
    setLoading(false); // <--- Chamado imediatamente antes das queries acima resolverem!
  });
  ```
  Como o `setLoading(false)` é chamado antes da finalização de `loadRoles`, o aplicativo assume `loading = false` com o array de roles temporariamente vazio (`roles = []`). O layout de proteção de rota de `/admin` identifica o usuário autenticado mas assume que ele não é SuperAdmin, executando uma ejeção compulsória para `/app` num milissegundo de atraso.
* **Ação Executável:** Mudar `loadRoles` e `loadProfile` para serem assíncronas e estruturadas por promessas encadeadas (`Promise.all`), definindo o loading como falso somente após a obtenção integral de perfis e funções corporativas.

---

## 📈 Próximos Passos recomendados do Processo de Certificação

1. **Aprovação do Roadmap**: Validar com a gerência de desenvolvimento a implementação sequencial do bloco de correções acima.
2. **Ambiente Isolado (Staging)**: Implementar as correções no ramo de desenvolvimento de código do repositório para homologação individual das funcionalidades sem risco à integridade da plataforma imobiliária rodando hoje em produção.
