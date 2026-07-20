# CLAUDE.md — imoB365 SaaS

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- SMTP: ainda usando placeholder (`fake_mail_user`) — sem isso, e-mails de confirmação/recuperação de senha do GoTrue não são enviados de verdade
- A migration `20260521134506_..._f9f2cc82...sql` (seed do papel `super_admin` do usuário real) não foi aplicada durante os testes de schema — não é mais necessária, pois o dump real já trouxe `user_roles` populado

### 📋 Backlog (próximas versões)

Consolidado por tema em 2026-07-20 (revisão de PO — deduplicado, sem Cloudflare no escopo).

#### Integrações externas pendentes (hoje mockadas ou parciais)

- Bureau de crédito real (Serasa Experian ou similar) para a "Análise de Risco" (`/app/leads/analise-risco`, `src/lib/creditScore.ts`) — hoje o score/fatores/histórico são derivados deterministicamente do CPF (mock, sem chamada externa real, mesma lógica já usada no widget de `app.leads.$id.tsx` desde a Sprint 7); substituir por chamada real quando houver contrato/API key (`SERASA_API_KEY`, documentar em `.env.example`)
- WhatsApp real via Evolution API: (1) substituir o deep-link `wa.me` atual em `whatsapp.ts` por integração real; (2) tornar o `WhatsAppFAB` do site público customizável por tenant (número/mensagem/posição próprios) — hoje é fixo com o número do imoB365
- Teste ponta-a-ponta real do checkout de assinatura do Mercado Pago (redirect + webhook + ativação do tenant) — não dá pra validar localmente porque `payer_email` precisa ser diferente do dono da conta MP (o token de acesso atual é da própria conta imoB365); validar com um pagador de teste real assim que for para produção
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

#### Infraestrutura, qualidade e operação

- CI/CD com SAST/DAST (GitHub Actions)
- Limpeza de lint/prettier pré-existente no CI: ~4219 erros de prettier/eslint espalhados por dezenas de arquivos não relacionados às sprints recentes — o job `Lint & Format` do `ci.yml` continua vermelho por causa disso (não bloqueia o build real, só o gate de qualidade). Os ~172 erros de `tsc --noEmit` já foram corrigidos em 2026-07-20 (ver changelog acima)
- Deploy em produção — **no ar desde 2026-07-20**: VPS Hostinger + Supabase self-hosted, `https://portal.imob365.com.br`, dados reais migrados (ver changelog "Deploy em produção" acima para detalhes completos). Pendente: reconfigurar Google OAuth pro self-host (redirect URI novo), configurar SMTP real (hoje placeholder — e-mails de auth não são enviados), documentar rotina de backup/monitoramento do Postgres self-hosted (deixa de ser responsabilidade da Supabase Cloud), reconciliar o drift descoberto entre as migrations locais e o schema real de produção (6 objetos não rastreados: ver changelog)

#### Institucional

- SLA formal documentado nos Termos de Uso
- Considerar Proposta B3 do reposicionamento nacional (mapa estilizado do Brasil com pontos/rede de conexão) como evolução visual futura da seção `#nosso-padrao` em `/a-imob365`, hoje resolvida via B2 (reaproveito de layout, troca de texto) — não há nenhum elemento de mapa/visual de localização no site público ainda
