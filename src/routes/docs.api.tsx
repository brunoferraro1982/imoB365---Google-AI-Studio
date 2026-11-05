import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Code2,
  Database,
  KeyRound,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  Atalhos,
  FaixaEtapas,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";
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
    <section className={`${CARD_GLASS} h-full p-6`}>
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
    <pre className="overflow-x-auto rounded-2xl bg-[#0b1220] p-4 text-xs leading-relaxed text-slate-100">
      <code>{children}</code>
    </pre>
  );
}

const ETAPAS_TOPO = [
  { icon: KeyRound, titulo: "Gerar chave" },
  { icon: Lock, titulo: "Autenticar" },
  { icon: Database, titulo: "Consultar" },
  { icon: Bell, titulo: "Receber eventos" },
];

const FLUXO_INTEGRACAO: Etapa[] = [
  { icon: KeyRound, titulo: "Gere a chave", texto: "Configurações → API" },
  { icon: Lock, titulo: "Autentique", texto: "Header X-Api-Key" },
  { icon: Database, titulo: "Consuma", texto: "Imóveis e leads em JSON" },
  { icon: Bell, titulo: "Assine eventos", texto: "Webhooks de saída" },
];

const FLUXO_WEBHOOK: Etapa[] = [
  { icon: Zap, titulo: "Evento", texto: "Ex.: lead.created" },
  { icon: ShieldCheck, titulo: "Assinatura", texto: "HMAC-SHA256 do corpo" },
  { icon: Send, titulo: "Entrega", texto: "POST na sua URL" },
  { icon: RefreshCw, titulo: "Nova tentativa", texto: "Se não houver 2xx em 10s" },
];

function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Documentação da API"
          seloIcon={Code2}
          titulo="API pública v1"
          destaque="para integrar seus sistemas."
          subtitulo="REST · JSON · autenticação por chave de API. Consulte imóveis, crie leads e receba eventos em tempo real."
        >
          <FaixaEtapas etapas={ETAPAS_TOPO} rotulo="Etapas da integração" />
          <Atalhos
            itens={[
              { id: "autenticacao", label: "Autenticação" },
              { id: "endpoints", label: "Endpoints" },
              { id: "webhooks", label: "Webhooks" },
              { id: "boas-praticas", label: "Boas práticas" },
            ]}
          />
        </HeroGlass>

        <section id="autenticacao" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 text-sm md:p-8`}>
              <span className={SELO}>Autenticação</span>
              <h2 className={TITULO_SECAO}>Uma chave por integração</h2>
              <p className="text-muted-foreground">
                Envie sua chave no header{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">X-Api-Key</code> em todas
                as requisições. Gere chaves em <strong>Configurações → API</strong>.
              </p>
              <Code>{`curl https://seu-dominio.com/api/public/v1/imoveis \\
  -H "X-Api-Key: <SUA_CHAVE>"`}</Code>
            </div>
            <Fluxograma
              titulo="Integração com a API"
              legenda="Fluxo da integração"
              etapas={FLUXO_INTEGRACAO}
              resultado="Integração segura e em tempo real"
            />
          </div>
        </section>

        <section id="endpoints" className={BLOCO_BRANCO}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>Endpoints</span>
              <h2 className={TITULO_SECAO}>Imóveis e leads</h2>
            </div>
            <div className="grid items-stretch gap-5 md:grid-cols-2">
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
            </div>
          </div>
        </section>

        <section id="webhooks" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 text-sm md:p-8`}>
              <span className={SELO}>Webhooks de saída</span>
              <h2 className={TITULO_SECAO}>Eventos no seu sistema</h2>
              <p className="text-muted-foreground">
                Configure URLs em <strong>Configurações → Webhooks</strong> para receber eventos:{" "}
                <code>lead.created</code>, <code>lead.atribuido</code>, <code>lead.convertido</code>
                , <code>imovel.publicado</code>, <code>contrato.assinado</code>,{" "}
                <code>contrato.ativo</code>.
              </p>
              <p className="text-muted-foreground">
                Cada entrega é assinada via header <code>X-Imob365-Signature</code> com HMAC-SHA256
                do corpo usando o segredo do webhook.
              </p>
            </div>
            <Fluxograma
              titulo="Entrega de webhook"
              legenda="Fluxo de entrega"
              etapas={FLUXO_WEBHOOK}
              resultado="Seu sistema sempre atualizado"
            />
          </div>
        </section>

        <section id="boas-praticas" className={BLOCO_BRANCO}>
          <div className={`${CARD_GLASS} mx-auto max-w-6xl p-6 text-sm md:p-8`}>
            <span className={SELO}>Limites e boas práticas</span>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Use HTTPS sempre.",
                "Não compartilhe sua chave em frontend público.",
                "Rotacione a chave em caso de suspeita.",
                "Webhooks: responda com 2xx em até 10s; falhas são re-tentadas.",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-muted-foreground dark:bg-white/5"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
