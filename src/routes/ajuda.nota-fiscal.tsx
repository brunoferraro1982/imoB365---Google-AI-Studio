import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

// Guia público completo pra conectar o Focus NFe ao imob365 e emitir
// Nota Fiscal de Serviço (NFS-e) de verdade — mesmo padrão dos guias de
// Facebook/Instagram, Canva e DocuSign, mas BYO simplificado (token de
// API, não OAuth) — confirmado que nenhum provedor de NFe/NFSe oferece
// fluxo de redirecionamento (ver CLAUDE.md, changelog 2026-09-09).
export const Route = createFileRoute("/ajuda/nota-fiscal")({
  head: () => ({
    meta: [
      { title: "Como emitir Nota Fiscal (NFS-e) — imob365" },
      {
        name: "description",
        content:
          "Guia completo, passo a passo, pra conectar sua conta Focus NFe ao imob365 e emitir Nota Fiscal de Serviço eletrônica de verdade.",
      },
    ],
  }),
  component: GuiaNotaFiscalPage,
});

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

function GuiaNotaFiscalPage() {
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
            Como emitir Nota Fiscal (NFS-e)
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Passo a passo completo pra emitir Nota Fiscal de Serviço eletrônica de verdade a partir
            de qualquer comissão — obrigatória por lei pra qualquer prestador de serviço desde
            janeiro de 2026 (NFS-e Nacional, LC 214/2025).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Antes de começar</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Leva de 15 a 30 minutos — a maior parte é registrar seu certificado digital.</li>
            <li>
              Você precisa de um <strong>certificado digital ICP-Brasil (e-CNPJ)</strong>, modelo A1
              (arquivo) ou A3 (token/cartão) — exigido por lei pra qualquer emissão de nota fiscal
              eletrônica, independente de qual sistema você use.
            </li>
            <li>
              Cada corretor/imobiliária cria a <strong>própria</strong> conta no Focus NFe — não é
              uma conta compartilhada do imob365, e o imob365 nunca guarda nem tem acesso ao seu
              certificado digital.
            </li>
            <li>
              Diferente de Meta/Canva/DocuSign, aqui não tem tela de autorização — é só colar um
              token de API, direto no formulário do imob365.
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-5 px-6 pb-16">
        <Passo numero={1} titulo="Crie sua conta no Focus NFe">
          <p>
            Acesse{" "}
            <a
              href="https://focusnfe.com.br"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              focusnfe.com.br <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            e crie uma conta (tem teste grátis de 30 dias). Escolha um plano — o "Solo" (1 CNPJ) já
            cobre a maioria dos corretores/imobiliárias individuais.
          </p>
        </Passo>

        <Passo numero={2} titulo="Cadastre sua empresa e o certificado digital">
          <p>
            No painel do Focus NFe, cadastre seu CNPJ, sua Inscrição Municipal e faça upload do seu
            certificado digital (e-CNPJ, modelo A1 — arquivo .pfx). Se você ainda não tem um
            certificado, qualquer Autoridade Certificadora credenciada pela ICP-Brasil (Certisign,
            Serasa, Soluti etc.) emite um.
          </p>
        </Passo>

        <Passo numero={3} titulo="Copie o Token de acesso">
          <p>
            No painel do Focus NFe, acesse <strong>Integrações → API</strong> e copie o{" "}
            <strong>Token de acesso</strong> da sua empresa.
          </p>
        </Passo>

        <Passo numero={4} titulo="Configure no imob365">
          <p>
            No imob365, acesse <strong>Configurações → Nota Fiscal</strong>, cole o token, seu CNPJ,
            Inscrição Municipal e o código IBGE do seu município (tem um link direto pra consultar
            na própria tela). Deixe o item de serviço padrão <strong>10.05</strong> (corretagem
            imobiliária) e comece com o ambiente em <strong>Homologação</strong>.
          </p>
        </Passo>

        <Passo numero={5} titulo="Emita uma nota de teste">
          <p>
            Abra qualquer comissão em <strong>Financeiro → Comissões</strong>, role até "Nota
            Fiscal" e clique em <strong>"Emitir nota fiscal"</strong>. Preencha o nome e CPF/CNPJ de
            quem vai receber a nota. A emissão é assíncrona — clique no ícone de atualizar até o
            status virar "Autorizada" (geralmente leva alguns segundos a poucos minutos).
          </p>
        </Passo>

        <Passo numero={6} titulo="Passe pra produção">
          <p>
            Depois de confirmar que uma nota de teste saiu certo em Homologação, volte em{" "}
            <strong>Configurações → Nota Fiscal</strong> e ligue o interruptor de{" "}
            <strong>Ambiente de produção</strong>. A partir daí, toda nota emitida tem valor fiscal
            real e é comunicada à prefeitura.
          </p>
        </Passo>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Solução de problemas</h2>
        <div className="space-y-4">
          <ErroCard
            id="erro-certificado"
            titulo='"Regime Especial de Tributação ausente/inválido" ou erro de certificado'
          >
            <p>
              Confira se o certificado digital cadastrado no Focus NFe está válido (não vencido) e
              se o regime tributário (Simples Nacional ou não) marcado no imob365 bate com o que
              está cadastrado na Prefeitura da sua cidade.
            </p>
          </ErroCard>
          <ErroCard id="erro-municipio" titulo="Nota fica travada em “Processando” por muito tempo">
            <p>
              Alguns municípios demoram mais pra processar (a fila é da própria prefeitura, não do
              Focus NFe nem do imob365). Clique em atualizar novamente depois de alguns minutos. Se
              passar de um dia, confira o código IBGE do município cadastrado.
            </p>
          </ErroCard>
          <ErroCard id="erro-token" titulo='"Conecte e ative sua conta Focus NFe antes de emitir"'>
            <p>
              Confira em <strong>Configurações → Nota Fiscal</strong> se o token foi salvo e se o
              interruptor "Integração ativa" está ligado.
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
