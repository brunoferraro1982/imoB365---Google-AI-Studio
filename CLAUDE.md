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

| Segment | Purpose |
|---|---|
| `/` (`index.tsx`) | Public landing page / property search portal |
| `/app/*` | Authenticated back-office (tenant CRM) — guarded by `AppShell` |
| `/admin/*` | Super-admin panel (multi-tenant management) |
| `/conta/*` | End-user account area (saved searches, favorites, chat) |
| `/site.$slug/*` | White-label public site per tenant |
| `/api/public/*` | Server-only API routes (REST + XML feeds + cron) |
| `/lovable/*` | Email queue and webhook infrastructure |

### Multi-Tenancy
Every tenant has a `tenant_id` UUID in the `tenants` table. Supabase RLS enforces isolation.
The authenticated user's `tenant_id` is loaded by `useAuth()` from `profiles` and **must be passed to all Supabase queries** in the `/app` area.

### Auth & Roles
`src/hooks/useAuth.tsx` is the single source of truth for session state.

Roles stored in `user_roles` and exposed as `AppRole`:
- `super_admin` / `admin` / `broker` / `juridico` / `financeiro` / `atendente`

Server functions use `requireSupabaseAuth` middleware (`src/integrations/supabase/auth-middleware.ts`).

### Server Functions vs. Client Queries
- **Server functions** (`createServerFn`): in `src/lib/*.functions.ts` — always protected with `requireSupabaseAuth`. Use for mutations or anything touching secrets.
- **Direct Supabase client queries**: in route components for reads. Import from `@/integrations/supabase/client` (client) or `@/integrations/supabase/client.server` (server-only, has admin key).

### Key `src/lib/` Modules

| File | Purpose |
|---|---|
| `ai.functions.ts` | Gemini-powered text generation (property descriptions, scoring, chat) |
| `chat.functions.ts` | Real-time chat between leads and brokers |
| `favoritos.functions.ts` | Property favorites |
| `buscas-salvas.functions.ts` | Saved searches with email alert cron |
| `portais.ts` | Portal definitions (VivaReal, ZAP, OLX) — XML feeds at `/api/public/feeds/*` |
| `contractTemplatesLibrary.ts` | Built-in contract template library |
| `format.ts` | Brazilian currency/number formatting (`formatBRL`, etc.) |
| `whatsapp.ts` | WhatsApp deep-link generation |

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

## 🔴 Known Critical Bugs (block release if unresolved)

### QA-01 — Timezone shift no calendário de visitas
- **File**: `src/routes/app.visitas.tsx` (lines 41-45)
- **Root cause**: `.toISOString()` converts to UTC, shifting 21:00 BRT to next day
- **Fix**:
```typescript
// WRONG — shifts timezone to UTC
const k = new Date(v.data_hora).toISOString().slice(0, 10);

// CORRECT — uses local date getters
const d = new Date(v.data_hora);
const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

### QA-02 — UI sync issue em FotosManager
- **File**: `src/components/imoveis/FotosManager.tsx` (line 50)
- **Root cause**: Sync condition `items.length !== fotos.length` misses thumbnail-only updates
- **Fix**: Replace length comparison with deep key check or `useEffect` dependency on metadata

### QA-03 — Authentication bypass em cron endpoints
- **Files**: `src/routes/api.public.cron.buscas-alertas.ts`, `api.public.cron.visitas-notificacoes.ts`
- **Root cause**: When `SUPABASE_PUBLISHABLE_KEY` is empty, `expected = ""` bypasses the auth check
- **Fix**:
```typescript
// WRONG — empty string bypasses auth
if (!expected || apikey !== expected) { ... }

// CORRECT — explicit empty string check
if (!expected || expected === "" || apikey !== expected) { ... }
```

### QA-04 — Race condition no super admin role loading
- **File**: `src/hooks/useAuth.tsx` (lines 38-46)
- **Root cause**: `setLoading(false)` called before `loadRoles()` and `loadProfile()` resolve
- **Fix**: Use `Promise.all([loadRoles(id), loadProfile(id)])` before setting `loading = false`

---

## Security Requirements (OWASP baseline)
- **RLS is mandatory** on every Supabase table — never skip it
- `tenant_id` must be validated in every query in the `/app` area
- `.env` must **never** be committed (Gitleaks in CI)
- Validate all inputs with Zod on frontend AND server functions
- Signed temporary URLs for documents (15min expiry) — never permanent public URLs
- Rate limiting on auth endpoints (5 attempts → 15min block)

---

## UI Component Guidelines
`src/components/ui/` contains shadcn/ui components — prefer extending these over adding new UI libraries.

Custom domain components live in:
- `imoveis/` — property listing, detail, photos
- `leads/` — CRM pipeline, kanban
- `contratos/` — contracts, signatures
- `financeiro/` — commissions, billing
- `chat/` — real-time broker/lead chat
- `site/` — white-label tenant site
- `layout/` — shell, navigation, headers

---

## Development Workflow
- Branch per feature: `feature/nome-da-feature`
- Commits in PT-BR: `feat: adiciona simulador de financiamento`
- PR with review before merge to `main`
- Reference QA_ROADMAP.md and CADERNO_DE_TESTES.md for validation
