import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { toast } from "sonner";

// Guia público completo pra conectar a conta Canva pessoal ao imob365 —
// mesmo padrão e nível de detalhe do guia de Facebook/Instagram
// (ajuda.facebook-instagram.tsx), pedido explícito do usuário. Linkado
// direto do wizard (app.portais.canva.tsx) e listado na Central de Ajuda.
export const Route = createFileRoute("/ajuda/canva")({
  head: () => ({
    meta: [
      { title: "Como conectar sua conta Canva — imob365" },
      {
        name: "description",
        content:
          "Guia completo, passo a passo, pra conectar sua conta Canva ao imob365 e editar a imagem de posts/stories de imóvel no editor de verdade da Canva antes de publicar.",
      },
    ],
  }),
  component: GuiaCanvaPage,
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

function GuiaCanvaPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const redirectUri = `${origin}/api/public/canva/oauth/callback`;
  const returnUrl = `${origin}/app/imoveis/canva-retorno`;

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
            Como conectar sua conta Canva
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Passo a passo completo pra editar a imagem de qualquer post ou story de imóvel no editor
            de verdade da Canva, antes de publicar no Facebook e Instagram — sem depender de ninguém
            técnico.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Antes de começar</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Leva de 10 a 15 minutos na primeira vez — depois é só clicar em "Conectar".</li>
            <li>Você precisa de uma conta Canva (grátis ou Pro, não exige nenhum plano pago).</li>
            <li>
              É gratuito e não passa por nenhuma revisão da Canva. Cada corretor/imobiliária cria o{" "}
              <strong>próprio</strong> app na Canva (uma integração do tipo "Privada", visível só
              pra você) — não é um app compartilhado do imob365. Só integrações do tipo "Pública"
              (visíveis pra qualquer usuário Canva do mundo) exigem revisão, e não é o caso aqui.
            </li>
            <li>
              A Canva não permite embutir o editor dela dentro do imob365 — o fluxo abre uma aba
              nova pra você editar, e volta sozinho pro imob365 quando você clica em "Voltar" dentro
              do próprio editor da Canva.
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-5 px-6 pb-16">
        <Passo numero={1} titulo="Crie uma conta Canva (se ainda não tiver)">
          <p>
            Acesse{" "}
            <a
              href="https://www.canva.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              canva.com <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            e crie uma conta grátis. Se você já usa a Canva, pode seguir com a conta que já tem —
            não precisa ser uma conta nova.
          </p>
        </Passo>

        <Passo numero={2} titulo='Crie a integração (tipo "Privada")'>
          <p>
            Acesse{" "}
            <a
              href="https://www.canva.com/developers/integrations/connect-api"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              canva.com/developers <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            → <strong>"Criar uma integração"</strong> → escolha o tipo <strong>"Privada"</strong>{" "}
            (não "Pública" — a Privada não passa por revisão da Canva e funciona na hora) → dê o
            nome que quiser (ex.: "Corretor João — imob365").
          </p>
        </Passo>

        <Passo numero={3} titulo="Configure a autenticação (Redirect URI)">
          <p>
            Dentro da integração recém-criada, na aba <strong>"Autenticação"</strong>, cole o valor
            abaixo no campo de <strong>URI de redirecionamento</strong>:
          </p>
          <CopyLine value={redirectUri} />
          <p>
            Precisa ser exatamente esse valor — a Canva recusa a conexão se o endereço cadastrado
            aqui for diferente do que o imob365 realmente usa.
          </p>
        </Passo>

        <Passo numero={4} titulo="Marque as permissões (escopos)">
          <p>Ainda na integração, marque as quatro permissões abaixo:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="text-xs">asset:read</code> e{" "}
              <code className="text-xs">asset:write</code> — pra subir a imagem do imóvel como ponto
              de partida do design.
            </li>
            <li>
              <code className="text-xs">design:content:read</code> e{" "}
              <code className="text-xs">design:content:write</code> — pra criar o design e exportar
              a imagem final depois que você editar.
            </li>
          </ul>
        </Passo>

        <Passo numero={5} titulo="Configure a Navegação de retorno (obrigatório)">
          <p>
            <strong>Este é o passo que mais gente esquece.</strong> Sem ele, depois de editar você
            fica preso dentro da própria Canva — o "Voltar" não sabe pra onde te mandar.
          </p>
          <p>
            Na aba <strong>"Return navigation"</strong> da integração, ative a opção e cole o valor
            abaixo no campo de URL de retorno:
          </p>
          <CopyLine value={returnUrl} />
          <p>
            Diferente da URI de redirecionamento do passo 3 (que é só pra login), essa é a URL que a
            Canva usa pra te devolver pro imob365 depois que você termina de editar uma imagem —
            configurada uma única vez, vale pra todas as edições futuras.
          </p>
        </Passo>

        <Passo numero={6} titulo="Copie as credenciais e conecte no imob365">
          <p>
            Na aba <strong>"Configurações"</strong> da integração, copie o{" "}
            <strong>Client ID</strong> e o <strong>Client Secret</strong>. No imob365, acesse{" "}
            <strong>Portais → Canva</strong>, cole os dois valores, clique em "Salvar" e depois em{" "}
            <strong>"Conectar Canva"</strong>.
          </p>
        </Passo>

        <Passo numero={7} titulo="Edite sua primeira imagem">
          <p>
            Com a conexão feita, abra qualquer imóvel e role até a seção{" "}
            <strong>"Publicar nas redes sociais"</strong>. Escolha a foto e o modelo, clique em{" "}
            <strong>"Gerar prévia"</strong> e, quando aparecer, clique em{" "}
            <strong>"Editar no Canva"</strong> — a imagem já composta pelo imob365 abre numa aba
            nova, no editor de verdade da Canva.
          </p>
          <p>
            Edite à vontade (texto, cores, elementos, o que quiser) e, quando terminar, clique em{" "}
            <strong>"Voltar"</strong> dentro do próprio editor da Canva (não feche a aba). Você
            volta automaticamente pro imob365 com a imagem já editada pronta pra publicar.
          </p>
        </Passo>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Solução de problemas</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Os erros abaixo cobrem os pontos mais prováveis de travar, com base em como a própria
          Canva exige que essa conexão seja configurada.
        </p>
        <div className="space-y-4">
          <ErroCard id="erro-token-exchange" titulo='"A Canva recusou a autorização"'>
            <p>
              Confira se o <strong>Client ID</strong> e o <strong>Client Secret</strong> colados no
              imob365 são exatamente os que aparecem na aba "Configurações" da sua integração — sem
              espaços extras no início/fim. Confira também se a{" "}
              <a href="#passo-3" className="underline">
                URI de redirecionamento do passo 3
              </a>{" "}
              está cadastrada exatamente igual ao valor copiado (qualquer diferença, mesmo uma barra
              a mais no final, faz a Canva recusar).
            </p>
          </ErroCard>

          <ErroCard id="erro-state-invalido" titulo='"A conexão expirou ou é inválida"'>
            <p>
              O link de conexão com a Canva vale por 10 minutos. Se você abriu a tela de conectar e
              demorou mais que isso pra confirmar do lado da Canva, é só voltar em{" "}
              <strong>Portais → Canva</strong> e clicar em "Conectar Canva" de novo.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-nao-volta"
            titulo='Depois de editar e clicar em "Voltar", nada acontece / cai fora do imob365'
          >
            <p>
              Isso normalmente significa que a{" "}
              <a href="#passo-5" className="underline">
                Navegação de retorno do passo 5
              </a>{" "}
              não foi configurada, ou foi configurada com uma URL diferente da indicada aqui.
              Confira na aba "Return navigation" da sua integração se a opção está ativada e se a
              URL está exatamente igual à deste guia.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-sem-permissao"
            titulo='"Sem permissão para editar imagens desta imobiliária"'
          >
            <p>
              Editar no Canva exige que você seja <strong>administrador</strong> ou{" "}
              <strong>corretor</strong> do tenant — perfis como financeiro/jurídico/atendente não
              têm acesso a essa ação. Se você acha que deveria ter acesso, fale com o administrador
              da sua conta imob365.
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
