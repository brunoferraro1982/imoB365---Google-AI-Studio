# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**imob365** is a multi-tenant SaaS platform for the Brazilian real estate market. The imoB365 imobiliária itself is **Tenant 0** — the primary validation case (luxury segment).

### Modules
1. **Vendas** — properties, leads, pipeline CRM
2. **Financeiro** — commissions, billing
3. **Marketing** — campaigns, WhatsApp via Evolution API
4. **Jurídico** — contracts, digital signature
5. **E-Learning** — broker training/certification

### Known Critical Bugs (resolve before each release)
- Timezone shift in visit calendar
- UI sync issue in FotosManager
- Authentication bypass in cron endpoints
- Race condition in super admin role loading

## Commands

```bash
# Development
npm run dev          # Start dev server (Vite + TanStack Start)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build

# Code quality
npm run lint         # ESLint
npm run format       # Prettier (write)
```

No test suite is configured — there are no test scripts in package.json.

## Architecture Overview

**imob365** is a multi-tenant SaaS platform for Brazilian real estate agencies (imobiliárias). It combines a public-facing property portal with a full back-office CRM.

### Stack

- **Framework**: TanStack Start (SSR + file-based routing) + React 19
- **Routing**: TanStack Router — `src/routeTree.gen.ts` is auto-generated; never edit it manually
- **State/data fetching**: TanStack Query (`@tanstack/react-query`)
- **Backend/DB**: Supabase (Postgres + Auth + Realtime)
- **AI**: Google Gemini via `@google/genai` (`src/lib/ai.functions.ts`)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI primitives in `src/components/ui/`)
- **Maps**: Leaflet + react-leaflet (`src/components/MapaImoveis.tsx`)
- **Deployment target**: Cloudflare (via `@cloudflare/vite-plugin`)

### Route Segments

Routes follow TanStack Router's file-based conventions — dots in filenames map to `/` in paths:

| Segment | Purpose |
|---|---|
| `/` (`index.tsx`) | Public landing page / property search portal |
| `/app/*` | Authenticated back-office (tenant CRM) — guarded by `AppShell` |
| `/admin/*` | Super-admin panel (multi-tenant management) |
| `/conta/*` | End-user account area (saved searches, favorites, chat with broker) |
| `/site.$slug/*` | White-label public site per tenant |
| `/api/public/*` | Server-only API routes (REST + XML feeds + cron) |
| `/lovable/*` | Email queue and webhook infrastructure (Lovable platform) |

### Multi-Tenancy

Every tenant (imobiliária) has a `tenant_id` UUID in the `tenants` table. Row-level security (RLS) in Supabase enforces isolation. The authenticated user's `tenant_id` is loaded by `useAuth()` from the `profiles` table and must be passed to all Supabase queries in the `/app` area.

### Auth & Roles

`src/hooks/useAuth.tsx` is the single source of truth for session state. Roles are stored in `user_roles` and exposed as `AppRole`:

- `super_admin` / `admin` / `broker` / `juridico` / `financeiro` / `atendente`

Server functions use `requireSupabaseAuth` middleware (`src/integrations/supabase/auth-middleware.ts`) which validates the `Authorization: Bearer <token>` header and injects `{ supabase, userId, claims }` into the context.

### Server Functions vs. Client Queries

- **Server functions** (`createServerFn` from `@tanstack/react-start`): used in `src/lib/*.functions.ts` files. Always protected with `requireSupabaseAuth` middleware. Use for mutations or anything that touches secrets.
- **Direct Supabase client queries**: used in route components for reads. Import from `@/integrations/supabase/client` (client-side) or `@/integrations/supabase/client.server` (server-side only, has admin key).

### Key `src/lib/` Modules

| File | Purpose |
|---|---|
| `ai.functions.ts` | Server functions for Gemini-powered text generation (property descriptions, scoring, chat) |
| `chat.functions.ts` | Real-time chat between leads and brokers |
| `favoritos.functions.ts` | Property favorites |
| `buscas-salvas.functions.ts` | Saved searches with email alert cron |
| `portais.ts` | Portal definitions (VivaReal, ZAP, OLX) — feeds served as XML at `/api/public/feeds/*` |
| `contractTemplatesLibrary.ts` | Built-in contract template library |
| `format.ts` | Brazilian currency/number formatting (`formatBRL`, etc.) |
| `whatsapp.ts` | WhatsApp deep-link generation |

### Environment Variables

```
GEMINI_API_KEY              # Google Gemini API (server-side)
SUPABASE_URL                # Server-side Supabase URL
SUPABASE_PUBLISHABLE_KEY    # Client-safe anon key
VITE_SUPABASE_URL           # Build-time (Vite) Supabase URL
VITE_SUPABASE_PUBLISHABLE_KEY
APP_URL                     # Canonical URL (OAuth callbacks, self-referential links)
```

The Supabase client (`src/integrations/supabase/client.ts`) is auto-generated — do not edit it directly. Same applies to `src/integrations/supabase/types.ts` (generated from DB schema).

### Security Requirements

- RLS is mandatory on every Supabase table — never skip it
- `tenant_id` must be validated in every query in the `/app` area
- `.env` must never be committed
- OWASP Top 10 as the security baseline

### UI Components

`src/components/ui/` contains shadcn/ui components — prefer using or extending these rather than adding new UI libraries. Custom domain components live in subdirectories: `imoveis/`, `leads/`, `contratos/`, `financeiro/`, `chat/`, `site/`, `layout/`.
