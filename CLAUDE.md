# imoB365 SaaS — Contexto para Claude Code

> Leia este arquivo inteiro antes de qualquer ação no projeto.
> Atualizado: 2026-06-22

## O Projeto

imoB365 é um SaaS imobiliário multi-tenant brasileiro.
Stack: React 19 + TypeScript + TanStack Router/Query + Supabase (PostgreSQL + RLS + Auth) + Cloudflare Workers + Gemini API.

Repo GitHub: `brunoferraro1982/imoB365---Google-AI-Studio`
Especificação funcional completa: `/mnt/c/Users/bruno/Claude/Projects/imoB365 SAAS/imoB365-EspecificacaoFuncional-v1.0.docx`

---

## Arquitetura de Autorização

```
Plano → Módulo → Feature → Perfil → Usuário
```

**Planos** (tabela `plans`, PK = `slug`):
- `free` | `basic` | `standard` | `pro` | `business`
- NÃO usar códigos `plan-free`, `plan-basic` etc. — slugs são sem prefixo

**Módulos** (tabela `modules`, PK = `slug`):
- Schema real: `slug, nome, descricao, requires_plan, core, parent_slug, sort_order, is_active`
- `parent_slug IS NULL` = macro-módulo; `parent_slug IS NOT NULL` = feature
- Macro-módulos: `imobiliario`, `financeiro`, `marketing`, `juridico`, `elearning`

**Tenant×Módulo** (tabela `tenant_modules`):
- Usa ENUM `app_module`: `imobiliario, juridico, financeiro, marketing, ajustes, admin`
- RLS por tenant ativo

**Plan×Módulo** (tabelas `plan_modules`, `plan_features` — criadas Sprint 1):
- FK usa `module_slug TEXT REFERENCES modules(slug)`
- Trigger `fn_auto_plan_features`: liberar módulo → auto-libera todas as features filhas

**Perfis de usuário** (tabela `user_profiles`, PK = `code`):
- `perfil-corretor` | `perfil-corret-imob` | `perfil-adm-imob`
- `perfil-finac-imob` | `perfil-mkt-imob` | `perfil-jur-imob`

**Permissões** (tabela `profile_permissions`):
- PK: `(profile_code, feature_slug)` — FK em `modules(slug)`

---

## Regras de Negócio Críticas

### Segurança (OWASP A01)
- `aprovado` e `pagamento_validado` NUNCA vêm de `user_metadata` — fonte: tabela `profiles` + RLS
- `user_metadata` é gravável pelo usuário via `supabase.auth.updateUser()` — não usar como gate de auth

### MFA
- **REGRA FIXA**: `imob365br@gmail.com` tem `mfa_exempt = TRUE` — MFA NÃO ativo até produção
- Perfis com MFA obrigatório: `perfil-adm-imob` (gestor) e `perfil-finac-imob` (financeiro)
- Ativar MFA para o super admin APENAS ao fazer deploy em produção

### Módulos desabilitados
- `mkt-aut` (automação de cadências): DESABILITADO em `plan_features` até aprovação de QA

### Plano Business
- Trial de 30 dias no signup; auto-converte para Free se não assinar
- Edge function `convert-trial-to-free` trata a conversão automática

### Gating pós-login (auth-gating.ts)
Hierarquia de redirect:
1. Email não verificado → `/conta/verificar-email`
2. `aprovado=FALSE` + plano pago → `/pending-approval`
3. `plan_status = canceled` → `/conta/plano-cancelado`
4. `plan_status = past_due/suspended` → `/conta/pagamento-pendente`
5. Trial expirado → converter para free → dashboard
6. OK → `/app/dashboard`

---

## Estado Atual dos Sprints

### Sprint 1 ✅ (branch: `feature/sprint1-auth-seguranca-planos`)
- Fix OWASP A01: remove bypass `pagamento_validado` via user_metadata em `useAuth.tsx`
- `src/lib/auth-social.ts`: OAuth centralizado (Google ativo; LinkedIn/Facebook com guard "em breve")
- `src/lib/auth-gating.ts`: gating por plano e status
- Migrations aplicadas no banco:
  - `20260622000001`: complementa `plans` com `preco_anual`, `trial_dias`, `max_corretores`
  - `20260622000002`: módulos, features, `plan_modules`, `plan_features`, trigger
  - `20260622000003`: `user_profiles`, `profile_permissions`, `user_sessions`, colunas MFA em `profiles`, colunas `plan_code/plan_status` em `tenants`

### Sprint 2 🔄 (branch: `feature/sprint2-mfa-callback`)
Em andamento — migration `20260622000010_mfa_policies.sql` ainda não aplicada.

**Bloqueio ativo**: migration `20260622000003` falhou em `audit_log` porque a tabela já existe
com schema diferente do esperado.

Schema real do `audit_log` (criado em `20260521133506_605c454f...sql`):
→ Verificar com: `grep -iA 20 "audit_log" supabase/migrations/20260521133506_605c454f-c00c-4564-a148-270c98dd7965.sql`

**Próximas ações Sprint 2:**
1. Inspecionar schema real de `audit_log` e corrigir migration 003
2. Re-aplicar migrations via `npx supabase db push`
3. Verificar se `patch_auth_callback.py` integrou `resolveAuthGating` em `auth.callback.tsx`
4. Verificar se `MfaGuard` foi injetado no layout autenticado
5. Deploy edge function: `npx supabase functions deploy convert-trial-to-free`
6. PR: `feature/sprint2-mfa-callback` → `develop`

---

## Diretório de Implementação

```
/mnt/c/Users/bruno/Claude/Projects/imoB365 SAAS/implementacao/
├── sprint2/
│   ├── implementar-sprint2.sh       ← master script Sprint 2
│   ├── patches/
│   │   ├── patch_auth_callback.py   ← integra resolveAuthGating
│   │   └── patch_mfa_guard.py       ← cria MFA hook/component
│   ├── migrations/
│   │   └── 20260622000010_mfa_policies.sql
│   └── edge-functions/
│       └── convert-trial-to-free.ts
├── patches/                         ← Sprint 1
│   ├── patch_useauth.py
│   ├── patch_login_social.py
│   └── patch_email_gating.py
└── migrations/                      ← Sprint 1
    ├── 20260622000001_plans_seed.sql
    ├── 20260622000002_modules_features_seed.sql
    └── 20260622000003_profiles_audit_sessions.sql
```

---

## Git Flow

- Branch principal dev: `develop`
- Features: `feature/sprint{N}-{descricao}`
- Script mestre: `bash scripts/imob.sh` (existente no repo)
- Sempre criar branch de `develop`, PR de volta para `develop`

---

## Convenções de Schema

| Conceito | Coluna correta | Errado (não usar) |
|---|---|---|
| Plano (FK) | `plano_slug TEXT REFERENCES plans(slug)` | `plans(code)` |
| Módulo (FK) | `module_slug TEXT REFERENCES modules(slug)` | `modules(code)` |
| Nome de plano | `nome` | `name` |
| Preço mensal | `preco_mensal` | `price_monthly` |
| Limites | `limites JSONB` | `max_imoveis`, `max_users` |
| Ativo | `ativo` | `is_active` (plans) |

---

## Providers OAuth

- Google: **habilitado** no Supabase Dashboard
- LinkedIn OIDC: desabilitado — ativar quando configurar no Supabase
- Facebook: desabilitado — ativar quando configurar no Supabase
- Para habilitar: descomentar em `src/lib/auth-social.ts` → array `PROVIDERS_ENABLED`
