# imoB365

Plataforma SaaS multi-tenant para o mercado imobiliário brasileiro. A imobiliária imoB365 é o Tenant 0 — o caso de validação principal, antes de ir a mercado para outras imobiliárias e corretores.

Cinco pilares: Vendas (imóveis, leads, pipeline CRM), Financeiro (comissões, cobrança), Marketing (campanhas, WhatsApp), Jurídico (contratos, assinatura digital) e E-Learning (treinamento de corretores).

Stack: TanStack Start (SSR) + React 19, Supabase (Postgres + Auth + Realtime + RLS), Tailwind CSS v4 + shadcn/ui, Google Gemini para geração de conteúdo por IA.

> Arquitetura completa, convenções e fluxo de deploy: ver [`CLAUDE.md`](./CLAUDE.md).

## Ambientes

| Ambiente | Onde roda | Banco/Auth/Storage |
| :--- | :--- | :--- |
| Dev | `localhost` | Supabase Cloud |
| Produção | VPS própria (`portal.imob365.com.br`) | Supabase self-hosted |

O fluxo de deploy (dev → `develop` → `main` → deploy automático) está documentado no topo do `CLAUDE.md`.

## Rodar localmente

**Pré-requisitos:** Node.js 22+

1. Instalar dependências:
   ```
   npm install
   ```
2. Copiar `.env.example` para `.env` e preencher as credenciais do Supabase Cloud de desenvolvimento e a `GEMINI_API_KEY`.
3. Rodar o app:
   ```
   npm run dev
   ```

## Outros comandos

```bash
npm run build        # Build de produção
npm run lint          # ESLint
npm run format         # Prettier (write)
```

Sem suíte de testes automatizada — validação manual via `CADERNO_DE_TESTES.md`.
