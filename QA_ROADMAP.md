# 📋 Plano de QA & Roadmap de Correções — imob365

Análise de Quality Assurance da base de código **imob365 / Imóvel Conectado**.

## Status dos Bugs Críticos

| ID        | Item                                                      | Módulo                | Severidade | Status         |
| :-------- | :-------------------------------------------------------- | :-------------------- | :--------- | :------------- |
| **QA-01** | Shift de fuso horário no calendário de visitas            | `app.visitas`         | ALTA       | ✅ **Corrigido** |
| **QA-02** | Tela de fotos estática após alterar thumbnail (capa)      | `FotosManager`        | ALTA       | ✅ **Corrigido** |
| **QA-03** | Falha de bypass em autenticação de Cron Job               | `cron.buscas-alertas` | MÉDIA-ALTA | ✅ **Corrigido** |
| **QA-04** | Race condition + código malformado em useAuth             | `useAuth`             | MÉDIA      | ✅ **Corrigido** |

## Detalhamento das Correções

### ✅ QA-01: Shift de Fuso Horário em Calendário Interativo
- **Arquivo:** `src/routes/app.visitas.tsx`
- **Fix aplicado:** Substituído `.toISOString().slice(0,10)` por getters locais (`getFullYear()`, `getMonth()`, `getDate()`) em `MonthView` e no `useMemo grouped`.

### ✅ QA-02: Filtro de Sincronização em FotosManager
- **Arquivo:** `src/components/imoveis/FotosManager.tsx`
- **Fix aplicado:** Substituída condição `items.length !== fotos.length` por assinatura JSON profunda incluindo `id`, `capa`, `ordem` e `storage_path` como dependência do `useEffect`.

### ✅ QA-03: Bypass de Autenticação em Cron Endpoints
- **Arquivos:** `src/routes/api.public.cron.buscas-alertas.ts`, `api.public.cron.visitas-notificacoes.ts`
- **Fix aplicado:** Adicionado `expected.length < 20` como validação mínima de comprimento da chave (Supabase anon keys têm 200+ chars), eliminando o bypass por string vazia.

### ✅ QA-04: Race Condition + Código Malformado em useAuth
- **Arquivo:** `src/hooks/useAuth.tsx`
- **Problemas corrigidos:**
  1. `setLoading(false)` agora só é chamado após `Promise.all([loadRoles(), loadProfile()])` resolver no `getSession().then()`.
  2. Código de `tenant_modules` que estava erroneamente no bloco `else{}` do `onAuthStateChange` (onde `profileData` não existe e `await` não é permitido em callback não-async) foi movido para dentro de `loadProfile()`, no local correto após ter acesso ao `tenant_id`.
  3. `setEnabledModules([])` agora limpa corretamente no logout.

## Próximos Passos de Produto

Os 4 QA bugs críticos estão resolvidos. Itens pendentes de produto:
- WhatsApp via Evolution API (integração real, não apenas deep-link)
- Deploy em produção (Cloudflare Workers)
- Gateway de pagamento (Stripe)
- CI/CD com SAST/DAST (GitHub Actions)
- Multi-tenant go-to-market (onboarding self-service para novos tenants)
