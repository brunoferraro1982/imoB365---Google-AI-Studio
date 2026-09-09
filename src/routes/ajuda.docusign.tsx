import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { toast } from "sonner";

// Guia público completo pra conectar o DocuSign ao imob365 — mesmo padrão
// e nível de detalhe dos guias de Facebook/Instagram e Canva. DocuSign é a
// primeira integração de assinatura eletrônica deste projeto que de fato
// chama a API de um provedor real (as outras 4 opções de
// tenant_assinatura_config nunca tiveram integração real nenhuma).
export const Route = createFileRoute("/ajuda/docusign")({
  head: () => ({
    meta: [
      { title: "Como conectar o DocuSign — imob365" },
      {
        name: "description",
        content:
          "Guia completo, passo a passo, pra conectar sua conta DocuSign ao imob365 e enviar contratos pra assinatura eletrônica de verdade.",
      },
    ],
  }),
  component: GuiaDocusignPage,
});

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        {value}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copiado");
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`passo-${numero}`}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {numero}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold md:text-xl">{titulo}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function ErroCard({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-mono text-sm font-semibold text-foreground">{titulo}</p>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function GuiaDocusignPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const redirectUri = `${origin}/api/public/docusign/oauth/callback`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_60%)]" />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <Link
            to="/ajuda"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Central de Ajuda
          </Link>
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
            Como conectar o DocuSign
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Passo a passo completo pra enviar contratos direto pela API do DocuSign, com a
            confirmação de assinatura chegando automaticamente — sem depender de ninguém técnico.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Antes de começar</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Leva de 10 a 20 minutos, mais o tempo do Go-Live (ver passo 5 abaixo).</li>
            <li>
              Você precisa de uma conta DocuSign — grátis pra testar, um plano pago pra uso real
              contínuo.
            </li>
            <li>
              Cada corretor/imobiliária cria a <strong>própria</strong> Integration Key no DocuSign
              — não é um app compartilhado do imob365.
            </li>
            <li>
              <strong>Diferente de Meta e Canva</strong>: o DocuSign exige uma etapa própria deles
              chamada <strong>Go-Live</strong> antes da conexão funcionar de verdade com documentos
              reais — mesmo sendo uma integração de conta única. Geralmente é rápido (minutos a
              poucos dias), mas é uma etapa real, não pule.
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-5 px-6 pb-16">
        <Passo numero={1} titulo="Crie a Integration Key no DocuSign">
          <p>
            Faça login em{" "}
            <a
              href="https://admin.docusign.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              admin.docusign.com <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            → <strong>Integrações → Apps e Chaves</strong> →{" "}
            <strong>"Adicionar App e Chave de Integração"</strong> → dê o nome que quiser (ex.:
            "imob365 — Corretor João").
          </p>
        </Passo>

        <Passo numero={2} titulo="Configure a URI de redirecionamento">
          <p>
            Na página da sua Integration Key recém-criada, adicione o valor abaixo no campo de{" "}
            <strong>URI de redirecionamento do OAuth</strong>:
          </p>
          <CopyLine value={redirectUri} />
        </Passo>

        <Passo numero={3} titulo="Gere a Secret Key">
          <p>
            Ainda na mesma página, clique em <strong>"Adicionar Secret Key"</strong> — copie o valor
            mostrado na hora, porque o DocuSign só exibe a Secret Key uma vez.
          </p>
        </Passo>

        <Passo numero={4} titulo="Copie as credenciais e conecte no imob365">
          <p>
            No imob365, acesse <strong>Configurações → Assinatura eletrônica</strong>, cole a{" "}
            <strong>Integration Key</strong> (Client ID) e a <strong>Secret Key</strong>, clique em
            "Salvar" e depois em <strong>"Conectar DocuSign"</strong>.
          </p>
        </Passo>

        <Passo numero={5} titulo="Go-Live — promova a chave pra produção">
          <p>
            <strong>Este é o passo que mais gente esquece, e o mais comum de dar erro.</strong> Uma
            Integration Key nova do DocuSign nasce no ambiente de testes (demo) — antes de funcionar
            com contratos e assinaturas reais, ela precisa passar pelo processo de{" "}
            <strong>Go-Live</strong> do próprio DocuSign, uma validação automática deles que
            geralmente leva de alguns minutos a poucos dias. O próprio painel do DocuSign avisa
            quando essa promoção é necessária — siga as instruções que aparecerem lá.
          </p>
        </Passo>

        <Passo numero={6} titulo="Envie seu primeiro contrato pra assinatura">
          <p>
            Com a conexão feita, abra qualquer contrato e role até a seção{" "}
            <strong>"Assinatura eletrônica"</strong>. Clique em{" "}
            <strong>"Gerar PDF do contrato"</strong> (abre a tela de impressão, já com o modelo
            certo), baixe o PDF e volte pra anexá-lo em <strong>"Anexar PDF gerado"</strong>. Depois
            é só clicar em <strong>"Solicitar assinatura"</strong> pra cada parte — o DocuSign envia
            o e-mail de assinatura de verdade, e o imob365 atualiza o status sozinho quando a pessoa
            assinar.
          </p>
        </Passo>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Solução de problemas</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Os erros abaixo cobrem os pontos mais prováveis de travar, com base em como a própria API
          do DocuSign exige que essa conexão seja configurada.
        </p>
        <div className="space-y-4">
          <ErroCard id="erro-token-exchange" titulo='"O DocuSign recusou a autorização"'>
            <p>
              Confira três coisas, nesta ordem: (1) a Integration Key e a Secret Key coladas no
              imob365 são exatamente as da aba "Apps e Chaves"; (2) a{" "}
              <a href="#passo-2" className="underline">
                URI de redirecionamento do passo 2
              </a>{" "}
              está cadastrada exatamente igual; (3) sua Integration Key já passou pelo{" "}
              <a href="#passo-5" className="underline">
                Go-Live do passo 5
              </a>{" "}
              — uma chave ainda em modo de testes não autentica contra o ambiente de produção.
            </p>
          </ErroCard>

          <ErroCard id="erro-state-invalido" titulo='"A conexão expirou ou é inválida"'>
            <p>
              O link de conexão com o DocuSign vale por 10 minutos. Se demorou mais que isso entre
              abrir a tela de conectar e confirmar do lado do DocuSign, volte em{" "}
              <strong>Configurações → Assinatura eletrônica</strong> e clique em "Conectar DocuSign"
              de novo.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-sem-tag"
            titulo="Assinatura enviada, mas o signatário não acha onde assinar"
          >
            <p>
              O imob365 tenta posicionar automaticamente a área de assinatura procurando o texto
              "Assinatura:" no PDF enviado. Se o modelo de contrato do seu tenant não tiver esse
              texto, o envelope ainda é enviado, mas sem a área marcada — é preciso ter{" "}
              <strong>"Free Form Signing"</strong> habilitado na sua conta DocuSign (opção nas
              configurações da conta, em "Envio e assinatura") pra a pessoa conseguir assinar em
              qualquer lugar do documento.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-nao-atualiza"
            titulo='Assinei no DocuSign, mas o status no imob365 continua "Aguardando assinatura"'
          >
            <p>
              A confirmação chega via um webhook nativo do DocuSign (Connect), configurado
              automaticamente quando você conectou a conta. Se ele falhou por algum motivo,
              desconecte e conecte a conta DocuSign de novo no imob365 — isso recria a configuração
              do Connect.
            </p>
          </ErroCard>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ainda travou em algum passo?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Fale com o suporte imob365 — respondemos todos os dias.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="mailto:contato@imob365.com.br">
              <Button size="lg">
                <MessageSquare className="mr-2 h-4 w-4" /> Falar com o suporte
              </Button>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
