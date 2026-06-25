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
- **Backend/DB**: Supabase (Postgres + Auth + Realtime + RLS)
- **AI**: Google Gemini via `@google/genai` (`src/lib/ai.functions.ts`)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI primitives in `src/components/ui/`)
- **Maps**: Leaflet + react-leaflet (`src/components/MapaImoveis.tsx`)
- **Deployment**: Cloudflare Workers (via `@cloudflare/vite-plugin`)

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

Usuários que entram via Google OAuth são redirecionados para `/auth/callback` → `/onboarding` (quando `tipo_usuario` ainda não está definido em `profiles`). Após o onboarding, vão para `/pending-approval`.

**Colunas que existem em `profiles`**: `id`, `tenant_id`, `nome`, `avatar_url`, `telefone`, `tipo_usuario`, `plano_pretendido`, `imobiliaria_nome`, `aprovado`, `pagamento_validado`, `pagamento_metodo`, `tema_preferido`.

**Não existem em `profiles`**: `status`, `oauth_provider`, `creci` — nunca referenciar essas colunas em queries. CRECI é salvo em `user_metadata` via `supabase.auth.updateUser()`. A coluna `status` pertence à tabela `tenants`.

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

### Environment Variables

```
GEMINI_API_KEY                  # Google Gemini API (server-side only)
SUPABASE_URL                    # Server-side Supabase URL
SUPABASE_PUBLISHABLE_KEY        # Client-safe anon key
VITE_SUPABASE_URL               # Build-time Supabase URL
VITE_SUPABASE_PUBLISHABLE_KEY   # Build-time anon key
APP_URL                         # Canonical URL (OAuth callbacks)
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

### 📋 Backlog (próximas versões)

- Módulo de BI / Relatórios avançados (avaliar Metabase, Superset ou nativo)
- API pública documentada (Swagger/OpenAPI) para integrações externas
- SLA formal documentado nos Termos de Uso
- Módulo de Atendimento ao Contratante (suporte in-app, tickets, chat)
- `mod-mkt-aut` — Cadências de automação (em desenvolvimento; bloqueado até QA)
- Integração CRECI via API nacional para validação de matrícula
- NPS in-app após 30 dias de uso ativo
- Health score de tenant para CS (Customer Success)
- WhatsApp via Evolution API (integração real — substituir deep-link atual em `whatsapp.ts`)
- Deploy em produção (Cloudflare Workers)
- Gateway de pagamento (NuBank / Pagar.me — NuBank adquiriu Pagar.me em 2021)
- CI/CD com SAST/DAST (GitHub Actions)
