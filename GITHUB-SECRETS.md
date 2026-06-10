# imoB365 — GitHub Secrets necessários para o CI/CD

Configure em: GitHub → Settings → Secrets and variables → Actions → New repository secret

## Secrets obrigatórios

| Secret | Descrição | Onde obter |
|---|---|---|
| `GEMINI_API_KEY` | Chave da API do Google Gemini | console.cloud.google.com |
| `SUPABASE_URL` | URL do projeto Supabase (server-side) | Supabase → Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key do Supabase | Supabase → Settings → API |
| `VITE_SUPABASE_URL` | Mesma URL (para o Vite no build) | Igual ao SUPABASE_URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Mesma anon key (para o Vite) | Igual ao SUPABASE_PUBLISHABLE_KEY |
| `APP_URL` | URL canônica do app (ex: https://imob365.com.br) | Sua configuração de domínio |
| `CLOUDFLARE_API_TOKEN` | Token da API do Cloudflare | dash.cloudflare.com → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare | dash.cloudflare.com → lado direito |

## Como criar o Cloudflare API Token

1. Acesse: https://dash.cloudflare.com/profile/api-tokens
2. Clique em "Create Token"
3. Use o template "Edit Cloudflare Workers"
4. Permissões necessárias:
   - Account: Cloudflare Workers Scripts → Edit
   - Zone: Workers Routes → Edit (se usar domínio customizado)
5. Copie o token gerado e adicione como secret no GitHub

## Environments do GitHub

Configure dois environments em GitHub → Settings → Environments:

### staging
- Sem proteções adicionais (deploy automático a cada push em develop)
- URL: https://staging.imob365.com.br

### production  
- ✅ Required reviewers: adicione seu usuário (aprovação manual antes do deploy)
- ✅ Wait timer: 5 minutos (tempo para cancelar se necessário)
- URL: https://imob365.com.br

## wrangler.jsonc — configuração de environments

Certifique-se que o wrangler.jsonc do projeto tem os environments configurados:

```jsonc
{
  "name": "imob365",
  "compatibility_date": "2024-01-01",
  "env": {
    "staging": {
      "name": "imob365-staging",
      "routes": [{ "pattern": "staging.imob365.com.br/*", "zone_name": "imob365.com.br" }]
    },
    "production": {
      "name": "imob365-production", 
      "routes": [{ "pattern": "imob365.com.br/*", "zone_name": "imob365.com.br" }]
    }
  }
}
```
