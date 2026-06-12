import { createFileRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "API pública v1 — imob365" },
      {
        name: "description",
        content:
          "Documentação da API REST pública da imob365: endpoints de imóveis, leads e webhooks.",
      },
    ],
  }),
  component: ApiDocsPage,
});

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  const color =
    method === "GET" ? "bg-emerald-600" : method === "POST" ? "bg-blue-600" : "bg-amber-600";
  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className={`rounded-md ${color} px-2 py-0.5 font-mono text-xs font-bold text-white`}>
          {method}
        </span>
        <code className="font-mono text-sm">{path}</code>
      </div>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl p-8">
        <header className="flex items-center gap-3">
          <Code2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API pública v1</h1>
            <p className="text-sm text-muted-foreground">
              REST · JSON · autenticação por chave de API
            </p>
          </div>
        </header>

        <section className="mt-8 space-y-3 text-sm">
          <h2 className="text-lg font-semibold">Autenticação</h2>
          <p className="text-muted-foreground">
            Envie sua chave no header{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">X-Api-Key</code> em todas as
            requisições. Gere chaves em <strong>Configurações → API</strong>.
          </p>
          <Code>{`curl https://seu-dominio.com/api/public/v1/imoveis \\
  -H "X-Api-Key: <SUA_CHAVE>"`}</Code>
        </section>

        <Endpoint method="GET" path="/api/public/v1/imoveis">
          <p>Lista imóveis publicados do tenant. Parâmetros de query:</p>
          <ul className="list-disc pl-5">
            <li>
              <code>tipo</code> — apartamento, casa, comercial, terreno…
            </li>
            <li>
              <code>finalidade</code> — venda, locacao
            </li>
            <li>
              <code>cidade</code>, <code>uf</code>
            </li>
            <li>
              <code>preco_min</code>, <code>preco_max</code>
            </li>
            <li>
              <code>limit</code> (padrão 20, máx 100)
            </li>
          </ul>
          <Code>{`{
  "items": [
    {
      "id": "uuid",
      "titulo": "Apartamento 3 quartos",
      "tipo": "apartamento",
      "finalidade": "venda",
      "preco": 750000,
      "cidade": "São Paulo",
      "uf": "SP",
      "url": "https://.../imovel/<slug>"
    }
  ],
  "count": 1
}`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/public/v1/leads">
          <p>Cria um lead no funil do tenant.</p>
          <Code>{`{
  "nome": "João da Silva",
  "email": "joao@example.com",
  "telefone": "+55 11 99999-0000",
  "mensagem": "Tenho interesse no imóvel",
  "imovel_id": "uuid (opcional)"
}`}</Code>
          <p>
            Resposta <strong>201</strong>:
          </p>
          <Code>{`{ "id": "uuid-do-lead" }`}</Code>
        </Endpoint>

        <section className="mt-12 space-y-3 text-sm">
          <h2 className="text-lg font-semibold">Webhooks de saída</h2>
          <p className="text-muted-foreground">
            Configure URLs em <strong>Configurações → Webhooks</strong> para receber eventos:{" "}
            <code>lead.created</code>,<code> lead.atribuido</code>, <code>lead.convertido</code>,{" "}
            <code>imovel.publicado</code>,<code> contrato.assinado</code>,{" "}
            <code>contrato.ativo</code>.
          </p>
          <p className="text-muted-foreground">
            Cada entrega é assinada via header <code>X-Imob365-Signature</code> com HMAC-SHA256 do
            corpo usando o segredo do webhook.
          </p>
        </section>

        <section className="mt-12 space-y-3 text-sm">
          <h2 className="text-lg font-semibold">Limites & boas práticas</h2>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>Use HTTPS sempre.</li>
            <li>Não compartilhe sua chave em frontend público.</li>
            <li>Rotacione a chave em caso de suspeita.</li>
            <li>Webhooks: responda com 2xx em até 10s; falhas são re-tentadas.</li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
