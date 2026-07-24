# CLAUDE.md — imoB365 SaaS

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Fluxo obrigatório de ambientes e deploy (leia isto primeiro)

Existem exatamente **2 ambientes** — não há staging separado:

| Ambiente | Onde roda | Banco/Auth/Storage |
| :--- | :--- | :--- |
| **Dev** | `localhost` (`npm run dev`) | Supabase **Cloud** (projeto `rqwljbqvyiyajvrdpzao`) |
| **Produção** | VPS Hostinger (`portal.imob365.com.br`, IP `179.197.231.61`) | Supabase **self-hosted** (Docker Compose na própria VPS) |

**Fluxo obrigatório para toda alteração de código, funcionalidade ou feature nova:**

1. Desenvolver e testar localmente em **dev** (`localhost` + Supabase Cloud) — nunca testar/experimentar direto contra o self-hosted de produção.
2. Abrir PR para `develop` — o CI (`ci.yml`, `qa-regression.yml`, `supabase-migrations.yml`) valida lint, TypeScript, build, QA e sintaxe de migrations.
3. Mergear em `develop`. Isso ainda **não** vai para produção — `develop` é só a branch de integração.
4. Quando pronto para liberar, abrir PR `develop` → `main`. Mergear esse PR **dispara o deploy automático** via `.github/workflows/deploy.yml`: build (`DEPLOY_TARGET=node`) → rsync para a VPS → restart do `imob365-app.service` → health check em `https://portal.imob365.com.br/`.
5. **Migrations de schema (`supabase/migrations/*.sql`) nunca são aplicadas automaticamente em produção** — o workflow de deploy só *avisa* (warning) se o PR trouxe migrations novas; aplicá-las no Postgres self-hosted da VPS é sempre um passo manual e confirmado à parte. Motivo: já foi encontrado drift real entre o histórico de migrations local e o schema de produção (objetos criados manualmente via Supabase Studio sem migration correspondente — ver changelog "Deploy em produção" abaixo) — não automatizar até esse processo estar mais maduro/confiável.
6. **Nunca aplicar mudança de schema direto em produção via SQL Editor/Studio manual** — sempre criar uma migration versionada no repo primeiro, mesmo que seja aplicada manualmente depois. É exatamente esse hábito que causou o drift acima.
7. **Repositório é privado** desde 2026-07-20, com limite de **2.000 minutos/mês de GitHub Actions** (plano free, conta pessoal — repos privados não têm minutos ilimitados como os públicos). Antes de disparar ações que consomem esse limite de forma não-trivial (ex.: rodar o pipeline completo várias vezes seguidas pra depurar algo, workflows adicionais, etc.), checar o consumo/saldo (`gh api users/brunoferraro1982/settings/billing/actions` — requer escopo OAuth `user` no token, rodar `gh auth refresh -h github.com -s user` uma vez se o comando retornar 404 por falta de permissão) e avisar o usuário do saldo antes de prosseguir, em vez de simplesmente executar.

Secrets do GitHub Actions relevantes: `VPS_SSH_HOST`, `VPS_SSH_KEY` (chave dedicada só de deploy, não a pessoal), `VPS_SUPABASE_URL`, `VPS_SUPABASE_PUBLISHABLE_KEY`, `VPS_GEMINI_API_KEY`. Os secrets antigos `PROD_SUPABASE_*`/`STAGING_SUPABASE_*`/`CLOUDFLARE_*` são de antes da migração para self-hosted e estão obsoletos.

**Branch protection em `main`/`develop` e as protection rules do Environment `production` não estão disponíveis** — GitHub Free só oferece isso em repos privados de conta pessoal com upgrade pro GitHub Pro (ou em repos públicos). Decisão: manter privado (prioridade de confidencialidade) e aceitar essa lacuna por ora; reavaliar se/quando houver upgrade de plano.

## Project Context

**imoB365** is a multi-tenant SaaS platform for the Brazilian real estate market.
The imoB365 imobiliária itself is **Tenant 0** — the primary validation case (luxury segment, Litoral Sul de SP).

### Strategic Goal

Transform imoB365 (luxury real estate agency) into a SaaS product, using its own operation as the validation case before go-to-market to other regional brokers and agencies.

### Modules (5 Pillars)

1. **Vendas** — properties, leads, pipeline CRM
2. **Financeiro** — commissions, billing, accounting
3. **Marketing** — automated campaigns, WhatsApp via Evolution API
4. **Jurídico** — contracts, digital signature, compliance
5. **E-Learning** — broker training, courses, certifications

---

## Commands

```bash
# Development
npm run dev          # Start dev server (Vite, port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build

# Code quality
npm run lint         # ESLint
npm run format       # Prettier (write)
```

No test suite configured — validate via CADERNO_DE_TESTES.md (manual QA).

---

## Architecture Overview

### Stack

- **Framework**: TanStack Start (SSR + file-based routing) + React 19
- **Routing**: TanStack Router — `src/routeTree.gen.ts` is auto-generated; **never edit manually**
- **State/Data**: TanStack Query (`@tanstack/react-query`)
- **Backend/DB**: Supabase self-hosted (Postgres 17 + Auth/GoTrue + Realtime + Storage + RLS via Docker Compose, VPS própria) — mesmo stack open-source da Supabase Cloud, mesma API `@supabase/supabase-js`
- **AI**: Google Gemini via `@google/genai` (`src/lib/ai.functions.ts`)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI primitives in `src/components/ui/`)
- **Maps**: Leaflet + react-leaflet (`src/components/MapaImoveis.tsx`)
- **Deployment**: VPS Hostinger (Ubuntu 24.04, Docker), build Nitro `node-server` (`DEPLOY_TARGET=node npm run build`), systemd (`imob365-app.service`) + nginx reverse proxy + TLS Let's Encrypt em `portal.imob365.com.br`. `wrangler.jsonc`/`@cloudflare/vite-plugin` seguem no repo como scaffolding herdado do build padrão (Lovable), mas Cloudflare **não está no escopo** de hospedagem de produção

### Route Segments

| Segment           | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `/` (`index.tsx`) | Public landing page / property search portal                   |
| `/app/*`          | Authenticated back-office (tenant CRM) — guarded by `AppShell` |
| `/admin/*`        | Super-admin panel (multi-tenant management)                    |
| `/conta/*`        | End-user account area (saved searches, favorites, chat)        |
| `/site.$slug/*`   | White-label public site per tenant                             |
| `/api/public/*`   | Server-only API routes (REST + XML feeds + cron)               |
| `/lovable/*`      | Email queue and webhook infrastructure                         |
| `/planos`         | Public pricing page (toggle mensal/anual, comparativo)         |
| `/blog/*`         | Public blog listing + article detail                           |
| `/calculadoras/*` | Public calculators (financiamento, ITBI, mudança)              |
| `/empreendimentos`| Public listing of published empreendimentos/lançamentos        |
| `/empreendimento/$slug` | Public detail page for a specific empreendimento         |
| `/docs/api`       | Public API documentation page                                  |

### Multi-Tenancy

Every tenant has a `tenant_id` UUID in the `tenants` table. Supabase RLS enforces isolation.
The authenticated user's `tenant_id` is loaded by `useAuth()` from `profiles` and **must be passed to all Supabase queries** in the `/app` area.

### Auth & Roles

`src/hooks/useAuth.tsx` is the single source of truth for session state. Returns: `session`, `user`, `roles`, `enabledModules`, `tenantId`, `profile`, `tenantInfo`, `userPermissions`, `isSuperAdmin`, `isAdmin`, `loading`.

Roles stored in `user_roles` and exposed as `AppRole`:

- `super_admin` / `admin` / `broker` / `juridico` / `financeiro` / `atendente`

Server functions use `requireSupabaseAuth` middleware (`src/integrations/supabase/auth-middleware.ts`).

#### Fluxo OAuth → Onboarding

Usuários que entram via Google OAuth ou e-mail são redirecionados para `/auth/callback` → `/onboarding` (quando `tipo_usuario` ainda não está definido em `profiles`). Após o onboarding, **acesso é imediato** — Trial Business 30 dias é provisionado automaticamente.

**Onboarding 3 etapas**: 1) Perfil (corretor/imobiliária) → 2) Dados (nome, telefone, CRECI ou imobiliária+CNPJ) → 3) Módulos de interesse (multi-select: mod-imob, mod-fin, mod-mkt, mod-juri, mod-elearn). Módulos selecionados são salvos em `plano_pretendido` como CSV e em `user_metadata.modulos_interesse` como array.

#### Trial Business 30 dias (spec §3.1)

- Todo usuário ao concluir onboarding recebe `plan-busi` por 30 dias via `provision_trial_business()` RPC
- Tenant é criado automaticamente com `status = 'trial'`, `trial_ends_at = now() + 30 days`, `plano_slug = 'business'`
- Todos os módulos são provisionados (trigger `tg_provision_tenant_modules`)
- Profile é aprovado automaticamente (`aprovado = true`), sem necessidade de aprovação manual
- Server function: `completeOnboarding` em `src/lib/onboarding.functions.ts`
- Cron `cron_expire_trials()` faz downgrade para `plan-free` ao expirar
- Colunas adicionadas em `tenants`: `trial_ends_at`, `plan_expires_at`, `cancelled_at`, `downgrade_to`

**Colunas que existem em `profiles`**: `id`, `tenant_id`, `nome`, `avatar_url`, `telefone`, `tipo_usuario`, `plano_pretendido`, `imobiliaria_nome`, `aprovado`, `pagamento_validado`, `pagamento_metodo`, `tema_preferido`.

**Não existem em `profiles`**: `status`, `oauth_provider`, `creci`, `cnpj` — nunca referenciar essas colunas em queries. CRECI e CNPJ são salvos em `user_metadata` via `supabase.auth.updateUser()`. A coluna `status` pertence à tabela `tenants`.

### Authorization Hierarchy

**Plan → Module → Feature → Profile → User** (see spec §2.1)

- Plan slugs: `plan-free` / `plan-basic` / `plan-stand` / `plan-pro` / `plan-busi`
- Module codes: `mod-imob` / `mod-fin` / `mod-mkt` / `mod-juri` / `mod-elearn`
- Profile codes: `perfil-corretor` / `perfil-corret-imob` / `perfil-adm-imob` / `perfil-finac-imob` / `perfil-mkt-imob` / `perfil-jur-imob`

### Server Functions vs. Client Queries

- **Server functions** (`createServerFn`): in `src/lib/*.functions.ts` — always protected with `requireSupabaseAuth`. Use for mutations or anything touching secrets.
- **Direct Supabase client queries**: in route components for reads. Import from `@/integrations/supabase/client` (client) or `@/integrations/supabase/client.server` (server-only, has admin key).

### Key `src/lib/` Modules

| File                          | Purpose                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `ai.functions.ts`             | Gemini-powered text generation (property descriptions, scoring, chat)        |
| `chat.functions.ts`           | Real-time chat between leads and brokers                                     |
| `favoritos.functions.ts`      | Property favorites                                                           |
| `buscas-salvas.functions.ts`  | Saved searches with email alert cron                                         |
| `geocode.functions.ts`        | Geocoding via Nominatim (address → lat/lon for map pins)                     |
| `relatorios.functions.ts`     | Dashboard KPIs and report data (funil, ranking, financeiro)                  |
| `portais.ts`                  | Portal definitions (VivaReal, ZAP, OLX) — XML feeds at `/api/public/feeds/*` |
| `contractTemplatesLibrary.ts` | Built-in contract template library                                           |
| `format.ts`                   | Brazilian currency/number formatting (`formatBRL`, etc.)                     |
| `whatsapp.ts`                 | WhatsApp deep-link generation (wa.me links — Evolution API integration pending) |
| `permissions.ts`              | RBAC matrix: `can()`, `canWithOverrides()`, `canAndEnabled()`               |
| `routeGuard.ts`               | TanStack Router `beforeLoad` guards (module/role-based access control)       |
| `serverAuth.ts`               | Server-side auth helpers (`requireServerAuth()`, JWT-based tenant_id)        |
| `team.functions.ts`           | Tenant team management (invite, list, remove members)                        |
| `admin.functions.ts`          | Admin server functions (listAdminUsers: profiles + auth emails/metadata)     |
| `onboarding.functions.ts`     | Onboarding completion: validates input, calls `provision_trial_business()` RPC |
| `mercadopago.functions.ts`    | `createMercadoPagoCheckout`: generates a dynamic checkout URL (preapproval or Checkout Pro) per tenant |

### Environment Variables

```
GEMINI_API_KEY                  # Google Gemini API (server-side only)
SUPABASE_URL                    # Server-side Supabase URL
SUPABASE_PUBLISHABLE_KEY        # Client-safe anon key
VITE_SUPABASE_URL               # Build-time Supabase URL
VITE_SUPABASE_PUBLISHABLE_KEY   # Build-time anon key
APP_URL                         # Canonical URL (OAuth callbacks)
MERCADOPAGO_ACCESS_TOKEN        # Mercado Pago API token (server-side only — checkout/preapproval)
MERCADOPAGO_WEBHOOK_SECRET      # Mercado Pago webhook HMAC signature secret (server-side only)
```

> `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` are auto-generated — **do not edit directly**.

---

## Security Requirements (OWASP baseline)

- **RLS is mandatory** on every Supabase table — never skip it
- `tenant_id` must be validated in every query in the `/app` area
- `.env` must **never** be committed (Gitleaks in CI)
- Validate all inputs with Zod on frontend AND server functions
- Signed temporary URLs for documents (15min expiry) — never permanent public URLs
- Rate limiting on auth endpoints (5 attempts → 15min block)
- `aprovado` and `pagamento_validado` must **never** be read from `user_metadata` — always from `profiles` table
- `mod-mkt-aut` (Marketing Automation) is **DISABLED** in `plan_features` until QA approval
- `imob365br@gmail.com` has `mfa_exempt = TRUE` — MFA not enforced until production

---

## UI Component Guidelines

`src/components/ui/` contains shadcn/ui components — prefer extending these over adding new UI libraries.

Custom domain components live in:

- `imoveis/` — property listing, detail, photos, FotosManager
- `imovel/` — public property detail widgets (AgendarVisita, SimuladorFinanciamento, HistoricoPreco, ImoveisSimilares)
- `leads/` — CRM pipeline, kanban
- `contratos/` — contracts, signatures
- `financeiro/` — commissions, billing
- `chat/` — real-time broker/lead chat
- `site/` — white-label tenant site
- `portal/` — public portal sections (newsletter, testimonials, partners)
- `admin/` — admin-specific components (ApprovalsNavBadge)
- `corretores/` — broker form components
- `brand/` — Logo component
- `theme/` — ThemeProvider, ThemeToggle
- `layout/` — AppShell, GlobalBreadcrumb, HeaderUserMenu, NotificationBell, WhatsAppFAB

---

## Development Workflow

- Branch per feature: `feature/nome-da-feature` branched from `develop`
- PRs target `develop` (not `main`)
- Commits in PT-BR: `feat: adiciona simulador de financiamento`
- Reference CADERNO_DE_TESTES.md for manual QA validation

---

## Roadmap de Sprints

### ✅ Concluídos

| Sprint | Escopo                                                          | Branch                              |
| :----- | :-------------------------------------------------------------- | :---------------------------------- |
| 1–2    | Fundação de segurança e dados                                   | `feature/sprint1-*`                 |
| 3–4    | Autenticação avançada (MFA, callback guard)                     | `feature/sprint2-mfa-callback`      |
| 5–6    | Onboarding 3 etapas + Trial Business 30d                        | `feature/sprint4-onboarding`        |
| 5–6    | Trial notifications + cron auto-downgrade                       | `feature/sprint5-trial-notif`       |
| 9–10   | RBAC completo — user_permissions + UI                           | `feature/sprint6-rbac-permissions`  |
| 11–12  | Ciclo de vida do plano (upgrade/downgrade/suspensão/cancelamento)| `feature/sprint7-plan-lifecycle`   |
| 13–14  | LGPD + auditoria de eventos sensíveis                           | `feature/sprint8-lgpd-audit`        |
| 15–16  | E-Learning completo, enforcement de cotas, portal institucional | `main` (commits diretos)            |
| 17–18  | Página /planos spec §13.1, fix onboarding/callback              | `feature/fix-planos-spec`           |
| 19–20  | Trial Business 30d auto-provisioning, módulos no onboarding     | `feature/fix-planos-spec`           |

### 🔧 Correções recentes (2026-06-15 → 2026-06-25)

| Arquivo                          | Correção                                                                                      |
| :------------------------------- | :-------------------------------------------------------------------------------------------- |
| `src/routes/planos.tsx`          | Toggle mensal/anual; limites spec §13.1 (5/20/60/140/∞); tabela comparativa de módulos       |
| `supabase/migrations/20260622000090_plans_spec_align.sql` | Adiciona `price_annual` e corrige `preco_mensal`/`limites` nos 5 planos |
| `src/routes/onboarding.tsx`      | Remove `status`/`oauth_provider` (colunas inexistentes); CRECI → `user_metadata`; erro real exibido |
| `src/routes/auth.callback.tsx`   | Remove `status` do SELECT; aprovação via `!profile.aprovado`                                  |
| `src/hooks/useAuth.tsx`          | QA-04 fix: race condition no loading de roles (Promise.all antes de setLoading)               |
| `src/routes/app.elearning.*`     | Módulo E-Learning completo (hub, visualizador, admin CMS)                                     |
| `supabase/migrations/*enforce*`  | Enforcement de cotas por plano (auto-approve Free, provision modules)                         |
| `src/components/portal/*`        | Portal institucional: página "A imoB365", menu dropdown, newsletter                          |
| `src/lib/ai.functions.ts`        | Lazy-init do GoogleGenAI + try/catch + detecção de placeholder + modelo atualizado para gemini-2.5-flash |
| `supabase/migrations/20260625*`  | RLS fix: imovel_fotos e storage — broker/super_admin podem fazer upload                       |
| `src/routes/app.imoveis.novo.tsx`| Fotos como PRIMEIRA seção da jornada de cadastro (placeholder → salvar → upload)              |
| `src/routes/imovel.$slug.tsx`    | Promise.allSettled + try/catch defensivo no carregamento de dados públicos do imóvel           |
| `src/routes/empreendimentos.tsx` | Página pública de listagem de empreendimentos publicados                                      |
| `src/routes/empreendimento.$slug.tsx` | Página pública de detalhe: galeria, espelho de unidades, sidebar resumo               |
| `src/components/site-layout.tsx` | Mega menu "Encontrar" + footer: adicionado link para /empreendimentos                         |
| `supabase/migrations/20260625000002*` | Policy super_admin para empreendimentos                                                |
| `supabase/migrations/20260625000003*` | Policy super_admin para empreendimento_unidades                                        |
| `src/routes/onboarding.tsx`      | Onboarding 3 etapas: Perfil → Dados (telefone) → Plano; salva cnpj em user_metadata          |
| `src/routes/admin.tenants.tsx`   | View unificada árvore hierárquica: tenants → usuários; tags para individuais; ações CRUD      |
| `src/lib/admin.functions.ts`     | Server function listAdminUsers: profiles + auth emails/metadata via admin API                 |
| `src/routes/auth.callback.tsx`   | Todos os users (email+OAuth) passam pelo check de onboarding/aprovação                        |
| `src/routes/login.tsx`           | Login redireciona para /auth/callback (não mais direto /app)                                  |
| `src/routes/signup.tsx`          | emailRedirectTo corrigido: /auth/callback em vez de /app                                      |
| `src/components/layout/AppShell.tsx` | Guard: redireciona para /onboarding se tipo_usuario é NULL; menu admin unificado          |
| `supabase/migrations/20260625000010*` | Trigger auto-approve exige tipo_usuario NOT NULL (onboarding concluído)                 |
| `supabase/migrations/20260625000011*` | Trial Business 30d: colunas lifecycle em tenants, RPC provision_trial_business, cron_expire_trials |
| `src/lib/onboarding.functions.ts`| Server function completeOnboarding: valida Zod, salva profile, provisiona Trial Business via RPC |
| `src/routes/onboarding.tsx`      | Etapa 3 → seleção de módulos (não planos); submit via server function; redireciona /app        |
| `src/routes/admin.tenants.tsx`   | Módulos de interesse como tags; edit modal com checkboxes de módulos                           |
| `supabase/migrations/20260626000001*` | Fix chave `modulos` ausente em `plans.limites` — desbloqueava provisionamento de módulos no Trial |

### 🔧 Correções recentes (2026-07-14)

| Arquivo                          | Correção                                                                                      |
| :------------------------------- | :-------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260714180000_mercadopago_subscriptions.sql` | Gateway de pagamento: Mercado Pago (assinaturas via `preapproval_plan` + cobrança avulsa para o Pro anual); `payment_events` para idempotência de webhook; agenda de verdade para `cron_expire_trials()` (nunca tinha sido agendado) |
| `src/integrations/mercadopago/client.server.ts` | Cliente server-only da API do Mercado Pago (`preapproval`, `checkout/preferences`, `payments`) |
| `src/lib/mercadopago.functions.ts` | Server function `createMercadoPagoCheckout`: gera o link de checkout dinamicamente por tenant (`external_reference`) |
| `src/routes/api.public.webhooks.mercadopago.ts` | Webhook de notificações (assinatura HMAC, idempotente) — ativa o tenant quando o pagamento é confirmado |
| `src/routes/api.public.cron.expire-trials.ts` | Cron diário: período de graça de 3 dias no fim do trial, com e-mail de aviso antes do downgrade para Free |
| `src/routes/app.contratacao.tsx`  | Troca escrita direta em `tenants` por redirect ao checkout do Mercado Pago (planos pagos); Free/Business inalterados |

### 🔧 Correções recentes (2026-07-15)

| Arquivo                          | Correção                                                                                      |
| :------------------------------- | :-------------------------------------------------------------------------------------------- |
| `src/routes/a-imob365.tsx`        | Remove todo vínculo geográfico ("Litoral Sul de SP", Santos/Praia Grande/São Vicente): head/meta, hero, Missão/Visão, narrativa, stat "cidades"→"Brasil"; seção `#litoral-sul` reconstruída como `#nosso-padrao` (curadoria) mantendo o mesmo layout 2 colunas |
| `src/routes/contato.tsx`          | Idem: head/meta, hero, CTA final, card "Região Atendida"→"Atendimento" (Todo o Brasil), stat "cidades"→"Brasil" |
| `src/routes/consultoria.tsx`      | Idem: head/meta e corpo sem menção a região                                                    |
| `src/components/site-layout.tsx`  | Nav mega-menu/mobile: label "Por que o Litoral Sul"→"Nosso Padrão de Curadoria", anchor `litoral-sul`→`nosso-padrao` |

### 🔧 Correções recentes (2026-07-16)

| Arquivo                                   | Correção                                                                                      |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `src/lib/creditScore.ts`                   | Novo: `gerarAnaliseRisco()` — extrai/compartilha a lógica de score (antes só em `app.leads.$id.tsx`), acrescenta `fatores`, `historico` e `recomendacoes` para a nova página |
| `src/lib/format.ts`                        | Novo: `maskCPF()` e `isValidCPF()` (dígito verificador real)                                   |
| `src/routes/app.leads.$id.tsx`             | Refatorado para usar `gerarAnaliseRisco()`/`maskCPF()`/`isValidCPF()` — mesmo comportamento visual, sem duplicar lógica |
| `src/routes/app.leads.analise-risco.tsx`   | Nova página "Análise de Risco" (`/app/leads/analise-risco`): consulta de CPF, gráficos (gauge, composição do score, tendência 6 meses via recharts) e conteúdo qualitativo para o corretor apresentar ao proprietário do imóvel; opção de vincular a um lead (grava nota na timeline) e de imprimir |
| `src/components/layout/AppShell.tsx`       | Novo item de menu "Análise de Risco" no grupo Imobiliário; `print:hidden` no header/aside do app shell (suporta o botão Imprimir da nova página) |

### 🔧 Correções recentes (2026-07-20)

| Arquivo                                      | Correção                                                                                      |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260720120000_favoritos_imovel_fk.sql` | Fix: `favoritos.imovel_id` nunca teve FK para `imoveis(id)` — `listarFavoritos()` (embed `imoveis:imovel_id(...)`) quebrava com "Could not find a relationship..." em `/conta/favoritos`; mesma causa já corrigida antes em `visitas` |
| `src/lib/favoritos.functions.ts`             | Nova server function `atualizarFavoritoPasta` — reaproveita a coluna `pasta` (já existente, nunca usada pela UI) |
| `src/routes/conta.favoritos.tsx`             | Organização por pasta (presets: "Para visitar" / "Comparar" / "Descartado"): filtro por chips + seletor por card; mantido (avaliado como PO/UX/marketing: não é redundante com o ranking agregado de favoritos do corretor em `/app/relatorios`, é a lista pessoal do usuário) |
| `src/components/layout/HeaderUserMenu.tsx`   | Mega menu (área logada): "Nossos Planos Starter & Pro" → "Nossos Planos Standard & Pro" (não existe plano "Starter"; o nome correto é "Standard", `plan-stand`); "Atalhos Operacionais"→"Acesso Fácil" com o mesmo destaque visual de "Central Imob365"; "Desconectar Conta"→"Sair"; "Papéis do Consórcio"→"Função"; botão "Anunciar novo imóvel" movido pra fora da coluna estreita do card de perfil (texto estava truncando); nome do usuário sem `truncate` forçado (`break-words`+`line-clamp-2`, evita estourar quando cai no fallback pro e-mail) |
| `src/routes/index.tsx`, `src/components/site-layout.tsx` | Remove auto-logout de 5min forçado na home (`supabase.auth.signOut()` sem base em atividade real do usuário — resquício de debug, não documentado como política de segurança) |
| ~172 erros de `tsc --noEmit` (Grupo A: `imovel.$slug.tsx`, `empreendimento.$slug.tsx`, `blog_.$slug.tsx`; Grupo B: 8 arquivos) | Pré-requisito pro deploy em produção. Grupo A: mesma causa raiz — `Route.useLoaderData()`/`head({ loaderData })` não infere o retorno do `createServerFn` usado no `loader`, corrigido com type assertion no ponto de uso (`errorComponent` garante os dados quando o componente renderiza). Grupo B: triagem individual por arquivo — inclui achado real de bug em `app.admin.aprovacoes.tsx` (consultava tabela inexistente `pending_registrations`; reescrito pra usar `listAdminUsers` filtrado por `!aprovado`, mesma fonte já usada em `ApprovalsNavBadge.tsx`). `npx tsc --noEmit` → 0 erros |
| `vite.config.ts`, `src/nitro-node-renderer.ts` (novo) | Fix: build com `DEPLOY_TARGET=node npm run build` (preset Nitro `node-server`, alvo VPS próprio) servia HTML de placeholder em toda rota (`<title>My Google AI Studio App</title>`) em vez do SSR real — Nitro detecta automaticamente o `index.html` da raiz do projeto como rota catch-all de fallback (SPA) e essa rota vencia sobre o handler SSR real do TanStack Start, que estava corretamente empacotado mas nunca era roteado. Corrigido com `nitro.renderer.handler` apontando pro novo adaptador, só pro build `DEPLOY_TARGET=node` — build padrão (Cloudflare/Lovable) não é afetado. Validado: HTML renderizado corretamente (58KB, título/meta tags reais) em `/`, `/login`, `/buscar` (rota com dado real); build padrão continua gerando `dist/server/server.js` normalmente |

### 🚀 Deploy em produção — VPS Hostinger + Supabase self-hosted (2026-07-20)

Infraestrutura provisionada, migrada e validada de ponta a ponta contra a VPS real (`portal.imob365.com.br`, IP `179.197.231.61`, KVM2 — 2 vCPU/8GB/96GB, Ubuntu 24.04). Site em produção, HTTPS válido, dados reais migrados.

| Item                              | O que foi feito                                                                                |
| :--------------------------------- | :----------------------------------------------------------------------------------------------- |
| Hardening da VPS                   | SSH só por chave (`PasswordAuthentication no`, `PermitRootLogin prohibit-password` — havia um drop-in do cloud-init da Hostinger sobrescrevendo isso, corrigido em `/etc/ssh/sshd_config.d/50-cloud-init.conf`); UFW ativo liberando só 22/80/443. Achado de segurança real corrigido: portas do Docker (Postgres 5432/6543, Kong 8000/8443) publicavam em `0.0.0.0`, **ignorando o UFW por completo** (Docker gerencia iptables por fora do UFW) — restrito pra bind em `127.0.0.1` no `docker-compose.yml` |
| Supabase self-hosted                | Docker Compose oficial (`supabase/supabase`), 11 containers saudáveis (Postgres 17, GoTrue, PostgREST, Kong, Storage, Realtime, Studio, imgproxy, Supavisor). Chaves geradas via `utils/generate-keys.sh` + `utils/add-new-auth-keys.sh` oficiais (legacy JWT + novas chaves opacas `sb_publishable_`/`sb_secret_`, mesmo formato já usado pelo app) |
| Migração de dados reais              | `supabase db dump --db-url` (role-only + schema + `--data-only --use-copy`) direto contra o projeto Cloud (`rqwljbqvyiyajvrdpzao`) — **não** replay das migrations locais, que têm drift real vs. produção (ver achado abaixo). Restaurado com sucesso: 94 tabelas, `auth.users` (2 contas reais), `tenants`, `imoveis` (5), `leads`, `user_roles`, etc. Arquivos de Storage (11 fotos + 1 logo) baixados da Cloud e re-enviados ao self-host via API REST (`storage/v1/object`) |
| **Drift real descoberto**: migrations locais ≠ schema de produção | Ao tentar recriar o schema via replay das 98 migrations locais (só pra teste, antes do dump real), 6 migrations falharam por referenciar objetos que existem na Cloud mas nunca foram commitados como migration: tabelas renomeadas sem migration (`modelos_contrato`→`contrato_templates`, `lancamentos`→`lancamentos_financeiros`), tabelas inexistentes localmente (`campanhas`, `documentos`, ambas existem em produção), coluna `elearning_cursos.tenant_id` nunca criada por migration, e a função `is_super_admin_safe()` (**usada em 6 migrations, controla quem vira super_admin**) nunca commitada. O dump real da Cloud trouxe o schema verdadeiro (94 tabelas vs. 78 do replay) — confirma que o histórico de migrations do repo não é fonte de verdade completa da produção |
| TLS + domínio                       | nginx como reverse proxy (`portal.imob365.com.br`→app Node porta 3000, `api.portal.imob365.com.br`→Kong porta 8000), certificados Let's Encrypt via certbot pros dois domínios, renovação automática validada (`certbot renew --dry-run`) |
| App em produção                     | Deploy via systemd (`imob365-app.service`, restart automático), build `DEPLOY_TARGET=node` apontando pro Supabase self-hosted |
| `src/nitro-node-renderer.ts`        | **Segundo bug real do Nitro `node-server`, achado só ao testar em navegador de verdade (não só curl/SSR)**: a página renderizava HTML correto mas nunca hidratava no cliente — zero erros no console, zero requisições de rede, travada pra sempre em "Carregando...". Causa: o renderer importava `./server` → `@tanstack/react-start/server-entry`, fazendo o Vite/Rollup empacotar uma **segunda cópia independente** do runtime do TanStack Start só pra essa entrada, com seu próprio manifest resolvido separadamente do `services.ssr` que o Nitro já constrói corretamente — essa segunda cópia caía, de forma não-determinística, numa referência de entrada de cliente só-de-dev que não existe em produção. Corrigido usando `fetchViteEnv("ssr", ...)` (`nitro/vite/runtime`) pra delegar pro serviço SSR que o próprio Nitro já constrói certo, em vez de disparar um build duplicado. Validado: 4 builds do zero consecutivas sem falha (antes era flaky) |
| Achado de UX/dados                  | Ao testar `/buscar` com sessão logada (usuário real migrado), confirmado que escrita via RLS também funciona (favoritar um imóvel persistiu corretamente) |

**Pendências para produção 100% completa** (não bloqueiam o que já está no ar):
- Google OAuth: precisa reconfigurar Client ID/Secret no self-host com redirect URI `https://api.portal.imob365.com.br/auth/v1/callback`
- ~~SMTP: ainda usando placeholder (`fake_mail_user`)~~ — corrigido em 2026-07-21, ver changelog "Correções recentes (2026-07-21)"
- A migration `20260521134506_..._f9f2cc82...sql` (seed do papel `super_admin` do usuário real) não foi aplicada durante os testes de schema — não é mais necessária, pois o dump real já trouxe `user_roles` populado

### ⚙️ Pipeline de CI/CD dev→develop→main→deploy automático (2026-07-20)

Formaliza o fluxo documentado no topo deste arquivo. Até então todo deploy era manual (build local + rsync + restart via SSH).

| Item | O que foi feito |
| :--- | :--- |
| `main` | Estava 43 commits atrasada desde a remoção do pipeline Cloudflare (2026-07-15) — sincronizada com `develop`, agora é o gate real de promoção pra produção |
| `.github/workflows/deploy.yml` (novo) | Disparado em push pra `main`: build (`DEPLOY_TARGET=node`) → upload do artifact → rsync pra VPS via chave SSH dedicada (`VPS_SSH_KEY`, não a pessoal) → `systemctl restart imob365-app` → health check com retry em `https://portal.imob365.com.br/`. Se o PR trouxe migrations novas em `supabase/migrations/`, só avisa (`::warning::`) — nunca aplica automaticamente (ver regra de migrations no topo do arquivo) |
| Secrets novos | `VPS_SSH_HOST`, `VPS_SSH_KEY`, `VPS_SUPABASE_URL`, `VPS_SUPABASE_PUBLISHABLE_KEY`, `VPS_GEMINI_API_KEY` — substituem os antigos `PROD_SUPABASE_*`/`STAGING_SUPABASE_*`/`CLOUDFLARE_*` (removidos, apontavam pra Supabase Cloud e Cloudflare, hoje obsoletos) |
| Build OOM no runner do Actions | O build `DEPLOY_TARGET=node` empacota libs pesadas (google-genai, jspdf, recharts, html2canvas, leaflet) em chunks self-contained — memória suficiente pra estourar o heap padrão do V8 e crashar (`JavaScript heap out of memory`, exit 134) no runner padrão do GitHub (7GB RAM). Aconteceu de forma não-determinística (o primeiro deploy real passou, o deploy seguinte, com o comando idêntico, crashou). Corrigido com `NODE_OPTIONS=--max-old-space-size=6144` no step de build do `deploy.yml`, dando margem real de heap |
| Limpeza de branches | Removidas 14 branches remotas antigas de backlog (sprints 1-9 já documentados como concluídos, `fix/qa-security-and-bugs`, e branches já mescladas) — só sobraram `develop` e `main` |
| Validação end-to-end | Testado o fluxo completo de verdade: mudança pequena (`/api/public/health` version bump) → dev → PR `develop` → merge → PR `develop→main` → merge → confirmado em produção via `curl`, sem nenhum passo manual |

### 🔒 Hardening de segurança do GitHub (2026-07-21)

Auditoria completa da configuração do repositório no GitHub, motivada pela existência de produção real (dados de usuários, infraestrutura de deploy, schema de banco todos versionados no repo).

| Item | O que foi feito |
| :--- | :--- |
| **Repositório era público** | Achado mais grave — qualquer um via todo o código, as 98 migrations (schema completo do banco) e os workflows (caminhos exatos da VPS). Tornado **privado**. Contrapartida aceita: repo privado de conta pessoal no plano free tem limite de 2.000 min/mês de Actions (público é ilimitado) — ver instrução no topo do arquivo sobre acompanhar esse saldo |
| Fork | `allow_forking` não pôde ser forçado via API (restrição do GitHub: só configurável em repo privado de organização, não de conta pessoal) — mas com o repo privado e único colaborador sendo o próprio dono, fork por terceiros já não é possível na prática |
| Branch protection em `main`/`develop` | **Não aplicada** — GitHub Free só permite em repo privado de conta pessoal com upgrade pro GitHub Pro, ou em repo público. Decisão: manter privado e aceitar a lacuna por ora (ver nota no topo do arquivo) |
| GitHub Environments | Existiam `production` (regra de required-reviewer, mas nunca referenciada em nenhum workflow — proteção inerte) e `staging` (vazio, sem uso real). A regra do `production` foi **removida automaticamente pelo próprio GitHub** ao tornar o repo privado (mesma restrição de plano da branch protection). `staging` foi **deletado** (não corresponde a nenhum ambiente real — só existem dev local e produção). `environment: production` foi adicionado ao job de deploy em `deploy.yml` mesmo assim, pelo rastro/histórico de deploy que a aba Environments continua dando de graça |
| Actions permissions | Estava `allowed_actions: all` (qualquer Action pública podia rodar). Restrito pra `selected`, com as 7 actions realmente em uso: `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`, `gitleaks/gitleaks-action`, `softprops/action-gh-release`, `supabase/setup-cli` |
| `README.md` | Era 100% o boilerplate original do Google AI Studio (banner, link `ai.studio/apps/<id>` expondo um ID de projeto interno, instruções incompletas). Reescrito com descrição real do projeto e instruções corretas |
| `.env.example` | Também estava incompleto (só listava `GEMINI_API_KEY`/`APP_URL`, faltavam as 6 variáveis do Supabase e Mercado Pago já documentadas na seção de Environment Variables deste arquivo) — corrigido |
| Descrição do repositório (GitHub) | "plataforma imob365 - ai studio" → descrição real, sem menção a AI Studio |

**Fora de escopo, por decisão explícita**: renomear o repositório (`imoB365---Google-AI-Studio` — nome fica como está, evita quebrar remotes/worktrees em uso); pin de Actions por SHA em vez de tag (fica no backlog abaixo).

### 🔧 Correções recentes (2026-07-21)

| Arquivo | Correção |
| :--- | :--- |
| `/app/comissoes` — sem editar/apagar, sem vínculo com contratos | Relato de produção. Causa raiz confirmada com dados reais: as 3 comissões existentes tinham `contrato_id` NULL (100% órfãs) — só existia criação automática via trigger do contrato, sem formulário manual, então qualquer registro fora desse fluxo só podia vir de insert direto no banco. Achado extra: o botão "Gerar comissão" em `app.contratos.$id.tsx` gravava direto em `lancamentos_financeiros`, nunca em `comissoes` — duas fontes de comissão desconectadas. Corrigido: novo `src/components/financeiro/ComissaoForm.tsx` (padrão de `LancamentoForm.tsx`, contrato+corretor obrigatórios via select real) com rotas `app.comissoes.novo.tsx`/`app.comissoes.$id.tsx`; `app.comissoes.index.tsx` ganhou Editar/Apagar em toda linha (antes só Pagar/Cancelar, só pra status `a_pagar`); o botão do contrato agora navega pro formulário novo em vez de gravar direto em `lancamentos_financeiros` — `comissoes` passa a ser a fonte única. Migration `20260721142228_comissoes_unique_contrato.sql` adiciona índice único parcial `comissoes(contrato_id)`, espelhando o que já existia em `lancamentos_financeiros`. Validado em navegador real (dev local): criar/editar/apagar, auto-preenchimento a partir do contrato, tudo funcionando. Migration confirmada aplicada em dev e produção na auditoria de paridade de 2026-07-23 (ver changelog). **Ainda pendente**: revisar manualmente as 3 comissões órfãs de produção na nova tela de edição |
| Home pública (`/`) — imoB365 listada em "Imobiliárias parceiras" | Relato de produção: o tenant institucional imoB365 (Tenant 0, dono de `imob365br@gmail.com`) aparecia na vitrine pública lado a lado com os clientes reais do SaaS, linkando para `/site/imob365` — conflito de credibilidade/posicionamento (fornecedora da plataforma parecendo concorrente das próprias imobiliárias-clientes). Corrigido em `src/routes/index.tsx`: query de tenants ganhou `.neq("slug", CORPORATE_TENANT_SLUG)` (constante já existente em `src/lib/corporateTenant.ts`, antes só usada em `/blog`). Achado colateral durante a verificação: como hoje **nenhum outro tenant** tem `status` `active`/`trial` em dev nem produção, a exclusão deixaria a lista sempre vazia — expondo um bug latente onde a condição de loading (`tenants.length === 0`) nunca distinguia "carregando" de "carregou e está vazio", travando os skeletons de placeholder pra sempre; corrigido com um novo estado `tenantsLoaded`. PR #62 → `develop` (CI verde), validado em navegador real. Limpeza de dado associada: `tenant_site_settings` (linha `publicado=true`, com "Sobre" ainda citando "Litoral Sul de São Paulo/Santos/Praia Grande/São Vicente" — inconsistente com o reposicionamento nacional de 2026-07-15) e `tenant_pages` (5 páginas de teste em dev, ex. "Temos o Ze e o Jão", "Vem com nois" — 0 em produção) do tenant `imob365` apagados manualmente em dev e produção, deixando `/site/imob365` cair no fallback `NotPublished` (`cfg` nulo em `site.$slug.tsx`); `tenants.tema.logo_url` mantido (é branding reaproveitado, não conteúdo de "página da imobiliária") |
| Validação de integração Mercado Pago em produção (checkout, webhook, cron de trial) | Auditoria ponta-a-ponta pedida antes da ativação real de meios de pagamento. Achado 1 (já quebrado em produção, sem relação com o teste): `/admin/faturamento` fazia `select` de `amount`/`currency` em `payment_events` — colunas que nunca existiram lá porque a migration `20260715150000_payment_events_amount.sql` nunca tinha sido aplicada no self-hosted (mesmo drift de "migration não é automática" já documentado); aplicada manualmente na VPS. Achado 2 (bug ativo, silencioso): os 3 jobs de `pg_cron` (`buscas-alertas-diario`, `processar-notificacoes-visitas`, `expire-trials-diario`, criados pela migration `20260715110000`) chamavam os endpoints `/api/public/cron/*` com uma `apikey` no formato JWT antigo, enquanto o self-hosted já emite chaves no formato novo (`sb_publishable_...`) — todo request batia 401 e era descartado, ou seja, **o downgrade automático de trial vencido nunca rodou em produção desde o deploy** (mesma causa afetaria os alertas de busca salva e as notificações de visita). Corrigido reagendando os 3 jobs via `cron.schedule()` (mesmo nome de job substitui o agendamento) com a `apikey` atual da VPS; `expire-trials` disparado manualmente após o fix retornou `200 {ok:true}`. Validação do fluxo de pagamento em si: criada uma assinatura real via API do Mercado Pago (`status: pending`, R$1, `external_reference` sintético não vinculado a tenant real) para exercitar `createPreapproval` contra a API de produção sem gerar cobrança; simulada a notificação de webhook com assinatura HMAC calculada com o `MERCADOPAGO_WEBHOOK_SECRET` real — processou corretamente e gravou `amount`/`currency` (confirma o Achado 1 corrigido); reenvio da mesma notificação foi tratado como duplicata (idempotência OK); assinatura inválida foi rejeitada com 401. Assinatura de teste cancelada no Mercado Pago e registro de teste apagado de `payment_events` ao final — nenhum tenant real foi alterado. Achado 3 (gap de robustez, não corrigido): o `UPDATE` final em `payment_events` (grava `processed_at`/`amount`/`currency`) não checa o erro retornado pelo Supabase client — no teste, um `tenant_id` sintético violou a FK e o update falhou silenciosamente sem afetar a resposta do webhook; com um tenant real a FK é satisfeita e não há erro, mas uma falha transiente futura ficaria invisível (a notificação já contaria como processada por idempotência). Achado 4 (pré-existente, não é do escopo de pagamento): a RLS `tenants_admin_update` libera `UPDATE` na linha inteira de `tenants` (inclusive `plano_slug`/`payment_status`) tanto pra role `admin` quanto `broker` — qualquer corretor da imobiliária consegue, hoje, disparar a troca pra Free ou iniciar um checkout pago pelo tenant, não só o admin. **Pendente, não verificável remotamente**: confirmar no painel de desenvolvedor do Mercado Pago que a URL `https://portal.imob365.com.br/api/public/webhooks/mercadopago` está cadastrada para os eventos de assinatura/pagamento — sem isso, o Mercado Pago nunca chama o webhook independente do código estar correto; e o teste real de contratação (pagador diferente da conta dona do token) continua pendente, ver item de backlog abaixo |
| SMTP não configurado — "Error sending confirmation email" no cadastro (`/signup`) em produção | Relato de produção via mega menu → Acessar Portal → Criar Conta. Causa raiz confirmada via SSH na VPS (`docker inspect supabase-auth`): GoTrue ainda usava o placeholder do exemplo self-hosted padrão (`GOTRUE_SMTP_HOST=supabase-mail`, usuário/senha `fake_mail_user`/`fake_mail_password`) — pior que um placeholder comum, o container `supabase-mail` **nem existe** entre os containers da VPS, então toda tentativa de e-mail de auth (confirmação de cadastro, recuperação de senha) falhava. O sistema de fila `/lovable/email/auth/webhook.ts` + `enqueue_email` que existe no código é infraestrutura morta nesse contexto — nenhum `GOTRUE_HOOK_SEND_EMAIL_*` liga o GoTrue a ele. Corrigido configurando SMTP real da Hostinger (`no-reply@imob365.com.br`) em `SMTP_HOST/PORT/USER/PASS/SENDER_NAME/ADMIN_EMAIL` no `.env` do compose (`/opt/imob365/supabase-src/docker/.env`, consumido pelo serviço `auth` como `GOTRUE_SMTP_*`), com backup do `.env` anterior e `docker compose up -d auth` para recriar o container com o novo ambiente (`restart` sozinho não recarrega o `.env`). **Achado real**: a porta 465 (TLS implícito, a que a Hostinger anuncia como padrão) trava o handshake até o GoTrue estourar seu timeout interno de requisição (10s, `context deadline exceeded`, 504) — conectividade TCP crua na 465 funciona (testado de dentro e fora do container), então não é bloqueio de rede/firewall, é a lib de e-mail do GoTrue não lidando bem com TLS implícito. Trocado para a porta **587** (STARTTLS, também aberta na Hostinger) — `/auth/v1/recover` disparado manualmente contra produção retornou 200 em ~2s, sem erro nos logs do `supabase-auth`. Pré-requisito desse fix: os 6 templates de e-mail de auth (`src/lib/email-templates/*.tsx`) foram reescritos com a identidade da imoB365 (PT-BR, cores da marca, layout compartilhado `_shared.tsx`) antes da troca de SMTP, a pedido do Bruno — PR #67 |
| Link de recuperação de senha caindo na home, não em `/reset-password` | Achado durante a validação do fix de SMTP acima. Causa raiz: `GOTRUE_URI_ALLOW_LIST` (`ADDITIONAL_REDIRECT_URLS` no `.env` do compose) só liberava `https://portal.imob365.com.br/auth/callback` — mas o app usa `redirectTo` pra `/reset-password` (`login.tsx`, `conta.perfil.tsx`) e `/app` (`HeaderUserMenu.tsx`, troca de e-mail) também. Como esses não estavam na allow-list, o GoTrue rejeitava o `redirect_to` pedido e caía no `GOTRUE_SITE_URL` (home) em silêncio. Corrigido trocando pra um wildcard `https://portal.imob365.com.br/**` — cobre qualquer caminho do próprio domínio (não é open redirect: só libera dentro do domínio da própria imoB365). Confirmado via `curl -v` direto no `/auth/v1/verify`: `Location` agora aponta pro `redirect_to` pedido, com o fragmento `#access_token=...` correto |
| E-mails de auth chegando com o template padrão do GoTrue (inglês, sem marca) mesmo com SMTP real configurado | O GoTrue self-hosted, no envio nativo por SMTP, usa os templates HTML embutidos dele — não os componentes React Email de `src/lib/email-templates/*.tsx` (esses só valeriam pro caminho `/lovable/email/auth/webhook.ts`, hoje desconectado). Resolvido publicando esses mesmos componentes como HTML estático com placeholders Go template (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`, `{{ .NewEmail }}`) numa rota nova `GET /api/public/email-templates/$type` (PR #68, deploy `develop→main` disparado e validado com health check verde) e apontando `GOTRUE_MAILER_TEMPLATES_CONFIRMATION`/`_RECOVERY`/`_MAGIC_LINK`/`_INVITE`/`_EMAIL_CHANGE`/`_REAUTHENTICATION` pras URLs correspondentes no `docker-compose.yml`/`.env` da VPS (variáveis novas, não existiam antes — precisou editar o compose, não só o `.env`). **Achado real e mais sério, descoberto ao testar**: o fetch do GoTrue pro template deu `dial tcp 127.0.0.1:443: connect: connection refused`. Causa: o `/etc/hosts` da própria VPS mapeia `portal.imob365.com.br`/`api.portal.imob365.com.br` pra `127.0.0.1` (conveniente pro host, quebra containers) — o resolver DNS embutido do Docker (`127.0.0.11`), ao não achar o hostname como nome de serviço/container, cai pro resolver do host e herda esse `127.0.0.1`, que dentro do container aponta pro próprio container, não pro host. **Isso também quebrava os 3 jobs de `pg_cron`** (`net.http_post` rodando dentro do container `supabase-db` pro próprio domínio) — confirmado via `net._http_response`: toda chamada dos últimos dias retornava erro `"Couldn't connect to server"`, ou seja, os crons de alertas de busca salva, notificação de visita e expiração de trial nunca completaram de verdade em produção, **mesmo depois do fix de `apikey` documentado acima** (o fix de apikey era necessário mas não suficiente). Corrigido com `extra_hosts: ["portal.imob365.com.br:host-gateway", "api.portal.imob365.com.br:host-gateway"]` nos serviços `auth` e `db` do `docker-compose.yml` — resolve pro gateway do Docker (`172.17.0.1`), que de fato chega no nginx do host. Validado: `wget` de dentro do `auth` e `net.http_get`/o comando real do `cron.job` de dentro do `db` retornando 200 depois do fix; e-mail de recuperação de senha real chegou com o template da imoB365, link levando pra `/reset-password` |

### 🔧 Correções recentes (2026-07-22)

| Arquivo | Correção |
| :--- | :--- |
| Upload de foto/logo em `/conta/perfil` — "Failed to fetch" em produção | Relato de produção ao testar a feature de foto do corretor (PR #72). Causa raiz: nenhum server block do nginx (`portal.imob365.com.br` nem `api.portal.imob365.com.br`, `/etc/nginx/sites-enabled/imob365`) tinha `client_max_body_size` configurado — o padrão do nginx é **1MB**, enquanto o app libera upload de imagem até 2MB no cliente (`src/lib/tenantBranding.ts`). Qualquer foto real entre 1-2MB (comum em foto de celular) era cortada pelo nginx antes de chegar no Storage; o corte no meio do envio aparece no navegador como `Failed to fetch` em vez de um 413 limpo. Confirmado na prática: upload de teste de 1.5MB direto no endpoint `api.portal.imob365.com.br/storage/v1/object/tenant-branding/...` retornava `413`. Corrigido adicionando `client_max_body_size 10m;` nos dois `location / {}` do nginx e `systemctl reload nginx` — reteste de 1.5MB e 2MB (o teto real do app) passou a retornar `400` (rejeitado só pela autenticação de teste inválida, não mais pelo tamanho) |
| Upload de foto/logo — "new row violates row-level security policy" logo depois do fix acima | Achado ao continuar testando em produção. Causa raiz: o bucket `tenant-branding` em `storage.objects` só tinha a policy `tenant_branding_public_read` (SELECT) — **nenhuma policy de INSERT/UPDATE/DELETE existia**, ou seja, esse upload nunca funcionou em produção pra ninguém (nem admin de imobiliária, nem corretor), desde a migração pro self-hosted. As tabelas `tenant_site_settings`/`tenant_pages` da mesma migration (`20260702232316_fix_broker_site_wizard_rls.sql`) já tinham sido aplicadas corretamente com suporte a `broker` — só a parte de `storage.objects` ficou de fora na reconciliação manual de produção. Corrigido recriando as 3 policies que faltavam (`tenant_branding_admin_write`/`_update`/`_delete`, liberando `admin` OU `broker` via `has_role_in_tenant`, mesma versão já existente na migration) direto no Postgres self-hosted. Confirmado via `pg_policies`: as 4 policies (SELECT/INSERT/UPDATE/DELETE) existem agora |

### 🔧 Correções recentes (2026-07-23)

| Arquivo | Correção |
| :--- | :--- |
| `supabase/migrations/20260723120000_add_tenants_area_atuacao.sql` | Nova feature: cidades e região de atuação para corretores/imobiliárias. Colunas `tenants.cidades_atuacao text[]` (máx. 3, texto livre) e `tenants.regiao_atuacao text` (máx. 120 chars, texto livre) — decisão deliberada de **não** criar tabelas de municípios/regiões do IBGE, já que "cidade" é texto livre em toda a base hoje (busca de imóveis, calculadora via CEP/ViaCEP) e "região" no sentido de mercado imobiliário (ex. "Litoral Sul de SP") é um rótulo coloquial sem lista nacional canônica. Sem RLS nova — `tenants_public_read`/`tenants_admin_update` já cobrem. Aplicada manualmente em dev e produção (fluxo padrão, migrations nunca são automáticas) |
| `src/components/CityChipsInput.tsx` | Novo componente: chips removíveis de texto livre com cap de quantidade (padrão de `CompararSelector.tsx`), reaproveitado no onboarding e no assistente de site |
| `src/lib/onboarding.functions.ts`, `src/routes/onboarding.tsx` | Etapa 2 (Dados) ganhou campos opcionais "Cidades de atuação" (até 3) e "Região de atuação"; gravados em `tenants` logo após `provision_trial_business()` (usa o `tenant_id` já retornado pela RPC), sem bloquear o avanço do onboarding |
| `src/routes/app.site.assistente.tsx` | Etapa "Título" pré-preenche cidades/região vindas do onboarding e permite editar; `finish()` deixou de só gravar em `tenants` quando havia logo — agora grava sempre (cidades/região + logo quando presente) |
| `src/routes/index.tsx` | Card de "Corretores e Imobiliárias parceiras" na home ganhou uma linha com ícone de pin mostrando cidades/região (mesmo padrão de truncamento já usado nos cards de imóvel/empreendimento deste arquivo), omitida por completo quando o tenant não preencheu nenhum dos dois campos |
| Auditoria de paridade dev × produção × repo (pedida explicitamente após a feature de cidades/região acima) | Varredura das migrations mais recentes (14/07 em diante) comparando schema real de dev (Supabase Cloud, via REST) e produção (self-hosted, via `psql` por SSH) contra o histórico do repo. Confirmado OK: índice único de `comissoes` por contrato (`20260721142228`, testado com insert duplicado real — a nota de "pendente aplicar" no changelog de 21/07 estava desatualizada), FK `favoritos.imovel_id`, colunas de Mercado Pago em `tenants`/`plans`, `tenant_domains`/`tenants.dominio_proprio` removidos, `tenant_site_settings.layout`/`secoes`. **Achado real**: `payment_events.amount`/`currency` (migration `20260715150000_payment_events_amount.sql`) foi aplicada manualmente em produção (ver changelog de 21/07) mas **nunca em dev** — gap não relacionado à feature de hoje, só apareceu nesta varredura. Corrigido no mesmo dia: SQL aplicado manualmente em dev, colunas confirmadas via REST (`payment_events?select=amount,currency` deixou de retornar erro de coluna inexistente) — paridade dev/produção restaurada |
| Storage `imovel-fotos` — upload de fotos de imóvel nunca funcionou em produção pra ninguém | Achado ao copiar manualmente (via UI, logado como o corretor real) os 7 imóveis publicados em `imob365.com.br/propriedades/` para o perfil de Bruno Ferraro em produção — o primeiro upload de foto retornou `"new row violates row-level security policy"`. Causa raiz: `storage.objects` só tinha a policy `"imovel-fotos public read"` (SELECT) — **nenhuma policy de INSERT/UPDATE/DELETE existia para o bucket `imovel-fotos`**, mesmo padrão de bug já corrigido antes para o bucket `tenant-branding` (ver changelog de 22/07). As policies de `public.imoveis`/`public.imovel_fotos` (broker/admin write) estavam corretas — só a parte de `storage.objects` da migration `20260625000001_fix_imovel_fotos_rls.sql` nunca tinha sido aplicada em produção. Corrigido recriando as 6 policies que faltavam (`imovel-fotos member write/update/delete` para membros do tenant + `imovel-fotos super_admin write/update/delete`) direto no Postgres self-hosted. Confirmado via `pg_policies` e reteste real: upload de fotos passou a funcionar; os 7 imóveis foram cadastrados com sucesso (descrição, specs, endereço e fotos em resolução original), publicados e atribuídos a Bruno Ferraro |
| QA do fluxo `/app/imoveis/novo`, a pedido do usuário, logo depois de cadastrar os 7 imóveis reais acima (papéis QA/PO/Design/Frontend) | Achado 1 (real, corrigido): campos numéricos (`preco`, `condominio`, `iptu`, `area_total`, `area_util`, `quartos`, `suites`, `banheiros`, `vagas` em `ImovelForm.tsx`) embaralhavam dígitos ao digitar rápido/com decimal (ex. `976509.78` virava `078` ou `0976510`) — causa clássica de `<input type="number">` controlado que faz `Number(e.target.value)` e reescreve o `value` do DOM a cada tecla, descartando o `.` no meio da digitação e correndo com o cursor do navegador. Corrigido com `src/components/ui/number-input.tsx` (novo): guarda o texto digitado como string local, só ressincroniza do valor externo quando o campo não está com foco. Validado em dev: `976509.78` e `318.5` persistidos byte-a-byte corretos no banco. Achado 2 (risco real, blindado preventivamente, não confirmado como causa de nada que eu tenha observado — ver nota abaixo): `AiImovelPanel.tsx`, botão "Gerar descrição", sobrescrevia `descricao` incondicionalmente quando a resposta da IA chegava, sem checar se o usuário editou o texto manualmente enquanto esperava. Corrigido com um `ref` que sempre reflete o valor mais atual de `descricao`, comparado com um snapshot tirado antes do `await` — se divergir, a sugestão não é aplicada e um toast explica o motivo. **Nota de rota**: a "descrição zerando" que percebi durante os cadastros reais foi investigada e não achou nenhum caminho de código que zere `descricao` no fluxo de criação — é mais provável que tenha sido artefato da minha própria automação de navegador (clique antes do elemento ter foco), não um bug confirmado do produto; o fix da IA acima é preventivo, não a explicação do que vi. Achados NÃO corrigidos nesta rodada (registrados no backlog abaixo): dropdown "Corretor responsável" sem busca e com nomes ambíguos/dados de teste misturados em produção; fluxo de fotos em duas etapas obrigatórias; formulário "Novo imóvel" como página única sem wizard |
| Galeria de fotos estática em `/imovel/$slug` e `/empreendimento/$slug` | Mesmo achado de QA acima — as duas páginas públicas de detalhe usavam um grid de `<img>` soltas (hero + até 4 miniaturas, `.slice(1, 5)` truncando silenciosamente o resto), sem clique, sem navegação, sem indicação de quantas fotos existiam. Corrigido com `src/components/imovel/GaleriaFotos.tsx` (novo): mantém o mesmo grid visual, mas cada tile agora é um botão que abre um lightbox em tela cheia (`Dialog` + `Carousel` do shadcn/ui, `embla-carousel-react` já era dependência do projeto, sem uso até então) na foto clicada, com contador "X / Y", setas prev/next, navegação por teclado e Esc/clique-fora pra fechar; badge "+N fotos" na última miniatura quando há mais de 5. `imovel.$slug.tsx` ampliou o `select` de `imovel_fotos` de `storage_path,capa` pra incluir `id,legenda,ordem` (key estável e alt text); `empreendimento.$slug.tsx` mapeia direto `fotos_urls` (já são URLs prontas, sem bucket). Helper `imovelFotoUrl()` centralizado em `src/lib/format.ts`, substituindo a mesma função duplicada em 5 arquivos (`FotosManager.tsx`, `ImoveisSimilares.tsx`, `buscar.tsx`, `index.tsx`, além do próprio `imovel.$slug.tsx`). Validado em navegador (dev): abertura no índice correto a partir do hero e do badge "+N", contador, setas, teclado e Esc, com imóvel de 2 fotos e com 7 (5 delas temporárias, criadas e apagadas só pra teste) |
| `src/components/imovel/GaleriaFotos.tsx` — enquadramento não-uniforme com menos de 5 fotos | Relato do usuário ao testar o item acima em dev, logo antes do deploy: com poucas fotos no total (1 a 4), a galeria não ficava com visual uniforme. Causa raiz: o container do grid não tinha altura explícita — o subgrid 2x2 das miniaturas dependia do conteúdo pra definir a altura das linhas, então linhas sem nenhuma miniatura colapsavam a zero, e a foto principal (que tenta esticar pra preencher as 2 linhas via `row-span-2`) acabava caindo pro tamanho intrínseco da própria imagem em vez de manter um recorte consistente — visualmente aparecia como uma foto principal desproporcionalmente alta ao lado de uma miniatura pequena e muito espaço vazio. Corrigido com altura fixa no container (`md:h-[480px]`) e spans dinâmicos pra miniatura conforme a quantidade real (1 preenche a metade direita inteira, 2 dividem em cima/baixo, 3 usa uma coluna cheia + duas empilhadas, 4+ mantém o 2x2 padrão com o badge "+N"). Validado em dev com 1, 2, 3, 4 e 7 fotos, e depois confirmado em produção (`/imovel/apartamento-cobertura-duplex-canto-do-forte-praia-grande`, 8 fotos reais): grid uniforme, badge "+3 fotos", lightbox abrindo no índice correto (1/8) com contador e setas — validação do usuário direto em produção. `/empreendimento/$slug` roda o mesmo componente mas ainda não tem nenhum empreendimento cadastrado pra testar com dado real |
| Login via Facebook/Meta (botão "Instagram" no mega menu, `HeaderUserMenu.tsx`) habilitado em produção | O botão já existia no código há tempo (`handleOAuthLogin("facebook")` → `signInWithOAuth`), mas nunca funcionou porque o GoTrue self-hosted não tinha nenhum provider externo de Facebook configurado — nem o bloco de env vars existia no `docker-compose.yml` (só havia exemplos comentados de Google/GitHub/Azure no template oficial do Supabase, nenhum de Facebook). Usuário criou um app no Meta for Developers (produto "Facebook Login", não "Instagram Basic Display" — não existe OAuth nativo de "login com Instagram" no Supabase/GoTrue, o mecanismo é sempre Facebook Login) e cadastrou o redirect URI `https://api.portal.imob365.com.br/auth/v1/callback` (endpoint do GoTrue, não a URL do próprio app). Corrigido: backup do `.env`/`docker-compose.yml`, adicionado `FACEBOOK_CLIENT_ID`/`FACEBOOK_SECRET` ao `.env` e um novo bloco `GOTRUE_EXTERNAL_FACEBOOK_ENABLED/CLIENT_ID/SECRET/REDIRECT_URI` ao `docker-compose.yml` (mesmo padrão do exemplo comentado do Google), seguido de `docker compose up -d auth`. Validado em produção: clique no botão redireciona corretamente pra tela real de login do Facebook com `app_id`/`redirect_uri`/`scope=email` corretos (sem o erro de "URI de redirecionamento inválido" que apareceu numa tentativa inicial de configuração no painel da Meta, causado por cadastrar a URL do app em vez da URL do GoTrue). **Pendente**: o botão equivalente em `src/routes/signup.tsx` ainda é um stub — só mostra um toast "Login via Instagram chega em breve" em vez de chamar `signInWithOAuth`; precisa ser trocado pra usar a mesma chamada real do `HeaderUserMenu.tsx`. `login.tsx` (página de login dedicada) não tem nenhum botão social ainda |

### 🔧 Correções recentes (2026-07-24)

| Arquivo | Correção |
| :--- | :--- |
| Login via Google habilitado em produção | Mesma causa-raiz do Facebook (ver changelog de 23/07): o botão já existia no código (`handleOAuthLogin("google")`/botão dedicado em `signup.tsx`), mas o GoTrue self-hosted tinha o bloco `GOTRUE_EXTERNAL_GOOGLE_*` comentado no `docker-compose.yml` (só um exemplo do template oficial, nunca habilitado) — confirmado testando o botão real em produção antes do fix: `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`. Usuário criou um OAuth Client ID no Google Cloud Console (tipo "Aplicativo da Web", redirect URI `https://api.portal.imob365.com.br/auth/v1/callback` — mesmo endpoint do GoTrue usado pro Facebook). Corrigido: backup do `.env`/`docker-compose.yml`, adicionado `GOOGLE_CLIENT_ID`/`GOOGLE_SECRET` ao `.env` e descomentado+habilitado (`GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"`) o bloco já existente no `docker-compose.yml`, seguido de `docker compose up -d auth`. Validado em produção clicando no botão real: login completo sem erro (o Chrome já tinha sessão Google ativa, então autenticou sem exibir a tela de consentimento) — resolve também o item que já estava documentado como pendência desde o deploy de 2026-07-20 ("Google OAuth: precisa reconfigurar Client ID/Secret no self-host"). **Efeito colateral do teste**: a validação usou a conta Google pessoal real do usuário (`bruno.ferraro09@gmail.com`, nunca logada antes no imoB365) e por isso ficou parada na tela 1/3 do onboarding (nenhum dado submetido, nenhum tenant/trial provisionado ainda) — deixada como está a pedido do usuário, para ele completar pessoalmente quando quiser |

### 📋 Backlog (próximas versões)

Consolidado por tema em 2026-07-20 (revisão de PO — deduplicado, sem Cloudflare no escopo).

#### Integrações externas pendentes (hoje mockadas ou parciais)

- Bureau de crédito real (Serasa Experian ou similar) para a "Análise de Risco" (`/app/leads/analise-risco`, `src/lib/creditScore.ts`) — hoje o score/fatores/histórico são derivados deterministicamente do CPF (mock, sem chamada externa real, mesma lógica já usada no widget de `app.leads.$id.tsx` desde a Sprint 7); substituir por chamada real quando houver contrato/API key (`SERASA_API_KEY`, documentar em `.env.example`)
- WhatsApp real via Evolution API: (1) substituir o deep-link `wa.me` atual em `whatsapp.ts` por integração real; (2) tornar o `WhatsAppFAB` do site público customizável por tenant (número/mensagem/posição próprios) — hoje é fixo com o número do imoB365
- Teste ponta-a-ponta real do checkout de assinatura do Mercado Pago com **pagamento de verdade** (redirect + webhook + ativação do tenant) — não dá pra validar localmente porque `payer_email` precisa ser diferente do dono da conta MP; a integração em si (token, assinatura de webhook, gravação em `payment_events`, idempotência) já foi validada em produção com uma assinatura de teste sem cobrança (ver changelog 2026-07-21 "Validação de integração Mercado Pago"), falta só o teste com pagador e cartão reais e confirmar no painel do Mercado Pago que o webhook está cadastrado para os eventos certos
- Integração CRECI via API nacional para validação de matrícula

#### Produto — módulos e funcionalidades novas

- Módulo de BI / Relatórios avançados (avaliar Metabase, Superset ou nativo)
- API pública documentada (Swagger/OpenAPI) para integrações externas
- Módulo de Atendimento ao Contratante (suporte in-app, tickets, chat)
- Widget de captura de leads em popup/banner no site público do tenant (ex-`conversion_widgets`, removido em 2026-07-03 por não ter renderização no portal — retomar só com o componente público de exibição já incluído no escopo)
- `mod-mkt-aut` — Cadências de automação (em desenvolvimento; bloqueado até QA)
- Loop de marketing para `/conta/favoritos`: notificar o lead por e-mail quando um imóvel favoritado mudar de preço ou sair do ar, e lembrete de retorno após X dias sem acessar — hoje a página só lista/organiza, não há nenhum gatilho automático de volta pro usuário
- NPS in-app após 30 dias de uso ativo
- Health score de tenant para CS (Customer Success)
- Achados de QA do fluxo `/app/imoveis/novo` (ver changelog 2026-07-23), fora do escopo corrigido naquela rodada: (1) dropdown "Corretor responsável" sem busca por texto, com nomes ambíguos ("Ferraro" vs "Bruno Ferraro" vs "Gustavo Ferraro") e ~7 usuários de teste ("QA Broker", "QA Cache"...) misturados com corretores reais na tabela `corretores` de produção — precisa de limpeza manual de dados + busca no combobox; (2) fluxo de fotos exige salvar o imóvel antes de poder anexar fotos (duas etapas obrigatórias), inconsistente com onboarding/assistente de site que já permitem upload no mesmo fluxo; (3) formulário "Novo imóvel" é uma página única muito longa, sem wizard por etapas nem indicador de progresso
- Login social — paridade e limpeza (ver changelog 2026-07-23, "Login via Facebook/Meta"): (1) `src/routes/signup.tsx` tem um botão "Instagram" que só mostra um toast ("chega em breve") em vez de chamar `signInWithOAuth({ provider: "facebook" })` como o equivalente do `HeaderUserMenu.tsx` (esse já funciona em produção); (2) `src/routes/login.tsx` (página de login dedicada) não tem nenhum botão social ainda — só email/senha, com um comentário no código adiando isso pra "release futura"; (3) avaliar se o rótulo "Instagram" nos botões deveria virar "Facebook", já que o mecanismo real é sempre Facebook Login (Meta) — não existe OAuth nativo de "Instagram" no Supabase/GoTrue, e o usuário cai na tela de consentimento do Facebook, não do Instagram

#### Infraestrutura, qualidade e operação

- CI/CD com SAST/DAST (GitHub Actions)
- Limpeza de lint/prettier pré-existente no CI: ~4219 erros de prettier/eslint espalhados por dezenas de arquivos não relacionados às sprints recentes — o job `Lint & Format` do `ci.yml` continua vermelho por causa disso (não bloqueia o build real, só o gate de qualidade). Os ~172 erros de `tsc --noEmit` já foram corrigidos em 2026-07-20 (ver changelog acima)
- Deploy em produção — **no ar desde 2026-07-20**: VPS Hostinger + Supabase self-hosted, `https://portal.imob365.com.br`, dados reais migrados (ver changelog "Deploy em produção" acima para detalhes completos). Pendente: reconfigurar Google OAuth pro self-host (redirect URI novo), documentar rotina de backup/monitoramento do Postgres self-hosted (deixa de ser responsabilidade da Supabase Cloud), reconciliar o drift descoberto entre as migrations locais e o schema real de produção (6 objetos não rastreados: ver changelog). SMTP real (Hostinger) configurado em 2026-07-21 (ver changelog)
- ~~GoTrue enviando e-mails de auth com o template padrão~~ — corrigido em 2026-07-21 (`GOTRUE_MAILER_TEMPLATES_*` + rota `/api/public/email-templates/$type`, PR #68), junto com o bug de DNS que também quebrava os `pg_cron` (ver changelog). Ainda falta setar `GOTRUE_MAILER_EXTERNAL_HOSTS=api.portal.imob365.com.br` (hoje ausente — só gera warning benigno nos logs, não bloqueia nada)
- Avaliar upgrade pro GitHub Pro — desbloquearia branch protection em `main`/`develop` e as protection rules do Environment `production` (required-reviewer antes de deploy), hoje indisponíveis por ser repo privado de conta pessoal no plano free (ver changelog "Hardening de segurança do GitHub")
- Pin de Actions por SHA em vez de tag (`actions/checkout@v4` → `@<sha>`, etc.) — hardening de supply-chain de baixa prioridade, registrado na auditoria de segurança de 2026-07-21

#### Institucional

- SLA formal documentado nos Termos de Uso
- Considerar Proposta B3 do reposicionamento nacional (mapa estilizado do Brasil com pontos/rede de conexão) como evolução visual futura da seção `#nosso-padrao` em `/a-imob365`, hoje resolvida via B2 (reaproveito de layout, troca de texto) — não há nenhum elemento de mapa/visual de localização no site público ainda
