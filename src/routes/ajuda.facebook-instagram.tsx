import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { toast } from "sonner";
import { META_WEBHOOK_VERIFY_TOKEN } from "@/lib/metaOAuth.functions";

// Guia público completo — nasceu de uma sessão real de suporte em que o
// usuário levou várias idas e voltas pra conectar a própria conta Meta
// (GRANT ausente, escopo de OAuth com nome errado, Página não atribuída
// como ativo do app, Configuração de Login/config_id pra Páginas de
// Portfólio Empresarial). Cada seção de "Solução de problemas" abaixo
// corresponde a um erro REAL que apareceu nessa sessão, não hipotético —
// e é linkado por âncora direto de dentro do wizard (app.portais.meta.tsx).
export const Route = createFileRoute("/ajuda/facebook-instagram")({
  head: () => ({
    meta: [
      { title: "Como conectar Facebook e Instagram — imob365" },
      {
        name: "description",
        content:
          "Guia completo, passo a passo, pra conectar sua Página do Facebook e Instagram ao imob365 — inclusive os passos que não são óbvios e a solução dos erros mais comuns.",
      },
    ],
  }),
  component: GuiaMetaPage,
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

function GuiaMetaPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const webhookUrl = `${origin}/api/public/webhooks/meta`;
  const redirectUri = `${origin}/api/public/meta/oauth/callback`;

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
            Como conectar Facebook e Instagram
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Passo a passo completo pra receber os leads das suas campanhas direto no funil do
            imob365 e publicar Post/Story de qualquer imóvel no Facebook e Instagram — sem depender
            de ninguém técnico.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Antes de começar</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Leva de 15 a 25 minutos na primeira vez — depois é só clicar em "Conectar".</li>
            <li>Você precisa de uma conta normal do Facebook e ser administrador da sua Página.</li>
            <li>
              É gratuito. Cada corretor/imobiliária cria o <strong>próprio</strong> aplicativo na
              Meta — não é um app compartilhado do imob365 — porque assim a conexão funciona na
              hora, sem fila de aprovação da Meta (essa fila só existe pra quem gerencia Páginas de
              outras empresas).
            </li>
            <li>
              Se sua Página foi criada dentro de um{" "}
              <strong>Portfólio Empresarial (Business Portfolio/Business Manager)</strong>, alguns
              passos extras são obrigatórios (4 e 5 abaixo) — é o ponto onde mais gente trava.
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-5 px-6 pb-16">
        <Passo numero={1} titulo="Acesse ou crie um Business Manager">
          <p>
            Vá em{" "}
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              business.facebook.com <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            e crie (ou entre) num Business Manager pra sua imobiliária/CRECI. Se você já administra
            a Página da sua imobiliária no Facebook, provavelmente já tem um — não precisa criar
            outro.
          </p>
        </Passo>

        <Passo numero={2} titulo='Crie o aplicativo (tipo "Negócios")'>
          <p>
            Acesse{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              developers.facebook.com/apps <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            → <strong>"Criar aplicativo"</strong> → escolha o tipo <strong>"Negócios"</strong> → dê
            o nome que quiser (ex.: "Corretor João — imob365"). Vincule o app ao Business Manager do
            passo 1 quando for perguntado.
          </p>
        </Passo>

        <Passo numero={3} titulo="Adicione os produtos necessários">
          <p>
            Dentro do aplicativo recém-criado, na tela inicial (ou em "Adicionar produto" no menu
            lateral), adicione os três produtos abaixo — clique em "Configurar" em cada um:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Login do Facebook para Empresas</strong> — é o que permite a conexão em si.
            </li>
            <li>
              <strong>Marketing API</strong> — usado pro catálogo de imóveis (Dynamic Ads).
            </li>
            <li>
              <strong>Instagram Graph API</strong> — é o que permite publicar Post/Story direto do
              imob365. Sem ele, só o Facebook funciona.
            </li>
          </ul>
        </Passo>

        <Passo numero={4} titulo="Autorize o app a acessar sua Página (obrigatório)">
          <p>
            <strong>Este é o passo que mais gente pula, e o mais comum de dar erro.</strong> Se sua
            Página pertence a um Portfólio Empresarial, a Meta só deixa você conceder acesso a ela
            depois que ela já está atribuída ao app — mesmo sendo você o administrador dela.
          </p>
          <p>
            Acesse{" "}
            <a
              href="https://business.facebook.com/settings/apps"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              business.facebook.com/settings/apps <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            → selecione o aplicativo que você criou → <strong>"Adicionar ativos"</strong> → aba{" "}
            <strong>Páginas</strong> → selecione sua Página → marque <strong>"Acesso total"</strong>{" "}
            → Salvar.
          </p>
        </Passo>

        <Passo
          numero={5}
          titulo="Crie uma Configuração de Login (se sua Página é de um Portfólio Empresarial)"
        >
          <p>
            Mesmo com o passo 4 feito, se a sua Página pertence a um Portfólio Empresarial, a Meta
            ainda exige uma <strong>Configuração de Login</strong> separada pra realmente liberar o
            acesso — sem ela, a conexão volta com "Nenhuma Página encontrada" mesmo tudo parecendo
            certo. (Se sua Página é pessoal, sem Portfólio Empresarial, você pode pular este passo.)
          </p>
          <p>Dentro do produto "Login do Facebook para Empresas" → aba "Configurações":</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Clique em "Criar configuração".</li>
            <li>
              Tipo de ativo: <strong>Página</strong>.
            </li>
            <li>Selecione a sua Página.</li>
            <li>
              Marque estas permissões: <code className="text-xs">pages_show_list</code>,{" "}
              <code className="text-xs">pages_manage_metadata</code>,{" "}
              <code className="text-xs">pages_manage_posts</code>,{" "}
              <code className="text-xs">pages_read_engagement</code>,{" "}
              <code className="text-xs">leads_retrieval</code>,{" "}
              <code className="text-xs">catalog_management</code>,{" "}
              <code className="text-xs">instagram_basic</code>,{" "}
              <code className="text-xs">instagram_content_publish</code>.
            </li>
            <li>Salve e copie o "ID de configuração" gerado.</li>
          </ol>
          <p>
            Volte no imob365, em <strong>Portais → Facebook/Instagram</strong>, e cole esse ID no
            campo <strong>"ID de Configuração de Login"</strong> (ele aparece depois que você já
            salvou o App ID/Secret do passo 9).
          </p>
        </Passo>

        <Passo numero={6} titulo="Vincule sua conta profissional do Instagram à Página">
          <p>
            Isso é feito no próprio Instagram, não no app da Meta: abra o app do Instagram no
            celular → Configurações → Contas vinculadas → Facebook → escolha a mesma Página da sua
            imobiliária. Sua conta do Instagram precisa ser profissional (Empresa ou Criador de
            conteúdo) — se ainda for pessoal, o próprio Instagram oferece a opção de trocar no mesmo
            menu.
          </p>
        </Passo>

        <Passo numero={7} titulo="Configure o Webhook (pra receber os leads de volta)">
          <p>
            Ainda dentro do app, no produto <strong>Webhooks</strong>, escolha o objeto{" "}
            <strong>"Página"</strong> e cole os dois valores abaixo:
          </p>
          <div className="space-y-2">
            <div>
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                URL de retorno de chamada
              </span>
              <CopyLine value={webhookUrl} />
            </div>
            <div>
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                Token de verificação
              </span>
              <CopyLine value={META_WEBHOOK_VERIFY_TOKEN} />
            </div>
          </div>
          <p>
            Depois, na lista de campos disponíveis, assine (clique em "Assinar" ao lado de) o campo{" "}
            <strong>"leadgen"</strong>.
          </p>
        </Passo>

        <Passo numero={8} titulo="Configure a URI de redirecionamento">
          <p>
            Ainda em "Login do Facebook para Empresas" → Configurações, cole o valor abaixo no campo{" "}
            <strong>"URI de redirecionamento do OAuth válido"</strong>:
          </p>
          <CopyLine value={redirectUri} />
        </Passo>

        <Passo numero={9} titulo="Copie as credenciais e conecte no imob365">
          <p>
            No app da Meta, vá em Configurações → Básico e copie o <strong>ID do aplicativo</strong>{" "}
            e a <strong>Chave secreta do aplicativo</strong> (a Meta pode pedir sua senha do
            Facebook pra mostrar a chave). No imob365, acesse{" "}
            <strong>Portais → Facebook/Instagram</strong>, cole os dois valores e clique em
            "Salvar". Se você fez o passo 5, cole também o ID de Configuração de Login que apareceu.
            Por fim, clique em <strong>"Conectar Facebook"</strong>.
          </p>
        </Passo>

        <Passo numero={10} titulo="Publique seu primeiro post">
          <p>
            Com a conexão feita, abra qualquer imóvel já publicado (em Imóveis, ao criar um novo ou
            editar um existente) e role até a seção <strong>"Publicar nas redes sociais"</strong>.
            Você escolhe:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Rede</strong>: Facebook, Instagram ou as duas.
            </li>
            <li>
              <strong>Tipo de post</strong>: Post (feed) ou Story.
            </li>
            <li>
              <strong>Tamanho</strong>: Quadrado (1:1) ou Retrato (4:5) pro Post — Story usa sempre
              9:16, formato vertical de tela cheia.
            </li>
            <li>
              <strong>Foto e modelo</strong>: a foto vira a capa com o modelo visual escolhido
              (título, preço e características sobrepostos).
            </li>
            <li>
              <strong>Incluir todas as fotos (carrossel)</strong>: opcional, só pra Post — as demais
              fotos do imóvel entram sem esse overlay, do jeito que já estão no portal.
            </li>
          </ul>
          <p>Gere a prévia, confira, e clique em "Publicar".</p>
        </Passo>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Solução de problemas</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Cada erro abaixo já apareceu de verdade pra algum tenant — junto vai exatamente por que
          acontece e o que fazer.
        </p>
        <div className="space-y-4">
          <ErroCard
            id="erro-nenhuma-pagina"
            titulo='"Nenhuma Página do Facebook encontrada nessa conta"'
          >
            <p>
              É o erro mais comum, e não significa que você errou nada óbvio — é uma exigência da
              Meta que não fica clara em lugar nenhum da própria interface deles. Confira, nesta
              ordem:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Sua Página está atribuída ao app? Veja o{" "}
                <a href="#passo-4" className="underline">
                  passo 4
                </a>{" "}
                (Adicionar ativos → Páginas → Acesso total).
              </li>
              <li>
                Sua Página pertence a um Portfólio Empresarial? Se sim, você também precisa do{" "}
                <a href="#passo-5" className="underline">
                  passo 5
                </a>{" "}
                (Configuração de Login) — só o passo 4 não é suficiente nesse caso.
              </li>
            </ol>
          </ErroCard>

          <ErroCard id="erro-invalid-scopes" titulo='"Invalid Scopes" na tela de autorização'>
            <p>
              Isso acontece quando o nome de uma permissão pedida não existe pro produto que seu app
              está usando. Se aparecer, é sinal de que o navegador carregou uma versão antiga em
              cache — recarregue a página do imob365 (Ctrl+Shift+R ou Cmd+Shift+R) e tente conectar
              de novo. Se persistir, fale com o suporte.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-instagram-nao-vincula"
            titulo='Depois de conectar, "Instagram ainda não vinculado"'
          >
            <p>
              A conexão com o Facebook funcionou, mas o imob365 não achou uma conta profissional do
              Instagram ligada à sua Página. Confira o{" "}
              <a href="#passo-6" className="underline">
                passo 6
              </a>{" "}
              (vincular pelo próprio app do Instagram) e, depois de vincular, clique em "Desconectar
              Página" e "Conectar Facebook" de novo no imob365 — a vinculação só é detectada numa
              conexão nova.
            </p>
          </ErroCard>

          <ErroCard
            id="erro-media-id"
            titulo='"Media ID is not available" ao publicar no Instagram'
          >
            <p>
              Esse era um erro real de processamento — o Instagram processa a imagem de forma
              assíncrona antes de publicar, e o imob365 tentava publicar cedo demais. Já foi
              corrigido do lado do imob365; se ainda aparecer, tente publicar de novo em alguns
              segundos e, se persistir, fale com o suporte.
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
