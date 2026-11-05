import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  DollarSign,
  Megaphone,
  Scale,
  GraduationCap,
  MessageSquare,
  Facebook,
  Palette,
  FileSignature,
  Receipt,
  ArrowRight,
  Search,
  ListChecks,
  Sparkles,
  Headset,
  Inbox,
  Bell,
} from "lucide-react";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  FaixaEtapas,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
  Atalhos,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/ajuda/")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — imob365" },
      {
        name: "description",
        content:
          "Guias rápidos para usar o imob365: cadastrar imóveis, fechar comissões, publicar em portais, gerar contratos e matricular sua equipe em cursos.",
      },
      { property: "og:title", content: "Central de Ajuda — imob365" },
      {
        property: "og:description",
        content: "Guias rápidos por jornada para tirar o máximo proveito da plataforma imob365.",
      },
    ],
  }),
  component: AjudaPage,
});

const ARTIGOS = [
  {
    icon: Building2,
    title: "Como cadastrar seu primeiro imóvel",
    steps: [
      "No menu do app, acesse Imóveis > Novo imóvel.",
      "O cadastro começa pelas fotos — suba as imagens e marque a foto de capa antes de preencher o resto.",
      "Preencha os dados básicos: tipo, finalidade (venda/aluguel), endereço e valor.",
      "Salve como rascunho ou publique direto — o imóvel só aparece no site público depois de publicado.",
      "Acompanhe pelo funil de leads assim que o primeiro contato chegar.",
    ],
  },
  {
    icon: DollarSign,
    title: "Como fechar e conferir uma comissão",
    steps: [
      "Acesse Financeiro no menu do app.",
      "Cada venda ou locação fechada gera um lançamento de comissão automaticamente, calculado a partir do valor do negócio.",
      "Revise o centro de custo e o plano de contas vinculados ao lançamento.",
      "Confira o dashboard de faturamento para ver o total do período.",
      "Gere o relatório financeiro para o fechamento mensal.",
    ],
  },
  {
    icon: Megaphone,
    title: "Como publicar um anúncio em todos os portais de uma vez",
    steps: [
      "Cadastre e publique o imóvel normalmente.",
      "Em Marketing > Portais, ative os portais que sua imobiliária usa (VivaReal, ZAP, Wimóveis, Chaves na Mão, Imovelweb, Mercado Livre, OLX).",
      "O feed é gerado automaticamente — não é preciso reenviar a cada alteração de preço ou status.",
      "Acompanhe o status de cada portal na tela de integrações.",
    ],
  },
  {
    icon: Scale,
    title: "Como gerar um contrato e coletar assinatura digital",
    steps: [
      "Acesse Jurídico > Modelos e escolha um modelo da biblioteca (ou crie um novo).",
      "Gere o contrato a partir do modelo, preenchendo os dados do negócio.",
      "Envie para assinatura digital — a integração cuida da coleta e validação.",
      "Acompanhe o status do contrato (rascunho, aguardando assinatura, assinado) e o histórico de versões.",
    ],
  },
  {
    icon: GraduationCap,
    title: "Como matricular sua equipe em um curso",
    steps: [
      "Acesse E-Learning no menu do app.",
      "Escolha um curso do catálogo, ou um modelo de curso para customizar.",
      "Matricule os corretores da sua equipe.",
      "Acompanhe o progresso e as certificações emitidas ao concluir.",
    ],
  },
  {
    icon: Facebook,
    title: "Como conectar Facebook e Instagram (e publicar imóveis nas redes)",
    steps: [
      "Cada corretor/imobiliária cria o próprio aplicativo gratuito na Meta — leva uns 20 minutos, mas tem alguns passos que não são óbvios.",
      "Depois de conectado, você recebe de volta os leads gerados pelas suas campanhas direto no funil do imob365.",
      "Também passa a poder publicar Post e Story de qualquer imóvel direto no Facebook/Instagram, com modelos prontos.",
    ],
    href: "/ajuda/facebook-instagram",
    linkLabel: "Ver guia completo, passo a passo",
  },
  {
    icon: Palette,
    title: "Como conectar sua conta Canva (e editar imagens antes de publicar)",
    steps: [
      "Cada corretor/imobiliária cria a própria integração gratuita na Canva — leva de 10 a 15 minutos, sem fila de aprovação.",
      "Depois de conectado, aparece a opção 'Editar no Canva' na prévia de post/story de qualquer imóvel.",
      "Você edita no editor de verdade da Canva, numa aba nova, e volta automaticamente pro imob365 com a imagem pronta.",
    ],
    href: "/ajuda/canva",
    linkLabel: "Ver guia completo, passo a passo",
  },
  {
    icon: FileSignature,
    title: "Como conectar o DocuSign (e enviar contratos pra assinatura de verdade)",
    steps: [
      "Cada corretor/imobiliária cria a própria Integration Key no DocuSign — leva de 10 a 20 minutos, mais o tempo do Go-Live (etapa própria do DocuSign).",
      "Depois de conectado, dá pra enviar contratos direto pela API, com PDF real anexado.",
      "A confirmação de assinatura chega automaticamente por webhook — o status atualiza sozinho no imob365.",
    ],
    href: "/ajuda/docusign",
    linkLabel: "Ver guia completo, passo a passo",
  },
  {
    icon: Receipt,
    title: "Como emitir Nota Fiscal (NFS-e) de verdade",
    steps: [
      "Obrigatória por lei pra qualquer prestador de serviço desde janeiro de 2026 (NFS-e Nacional).",
      "Cada corretor/imobiliária conecta a própria conta Focus NFe com o próprio CNPJ e certificado digital.",
      "Emite direto de qualquer comissão, com consulta de status até a nota sair autorizada.",
    ],
    href: "/ajuda/nota-fiscal",
    linkLabel: "Ver guia completo, passo a passo",
  },
];

type Artigo = (typeof ARTIGOS)[number];

const ETAPAS_TOPO = [
  { icon: Search, titulo: "Busque o guia" },
  { icon: ListChecks, titulo: "Siga o passo a passo" },
  { icon: Sparkles, titulo: "Pergunte à IA" },
  { icon: Headset, titulo: "Abra um chamado" },
];

const FLUXO_SUPORTE: Etapa[] = [
  { icon: Search, titulo: "Central de ajuda", texto: "Guias por jornada" },
  { icon: Sparkles, titulo: "Assistente de IA", texto: "Dúvidas respondidas na hora" },
  { icon: Inbox, titulo: "Chamado", texto: "Protocolo e prioridade" },
  { icon: Bell, titulo: "Acompanhamento", texto: "Resposta dentro do prazo" },
];

function CardGuia({ a }: { a: Artigo }) {
  return (
    <div className={`${CARD_GLASS} flex flex-col p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <a.icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold leading-snug">{a.title}</h3>
      </div>
      <ol className="relative mt-4 space-y-2.5 border-t border-black/5 pt-4 dark:border-white/10">
        {a.steps.map((st, i) => (
          <li key={i} className="relative flex gap-3 text-sm text-muted-foreground">
            {i < a.steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[9px] top-6 h-[calc(100%-6px)] w-px bg-primary/20"
              />
            )}
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {i + 1}
            </span>
            {st}
          </li>
        ))}
      </ol>
      {"href" in a && a.href && (
        <Link
          to={a.href as never}
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-primary hover:underline"
        >
          {a.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function AjudaPage() {
  const diaADia = ARTIGOS.filter((a) => !("href" in a));
  const integracoes = ARTIGOS.filter((a) => "href" in a);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Central de Ajuda"
          titulo="Guias rápidos por jornada"
          destaque="para usar a plataforma sem travar."
          subtitulo={
            <>
              Passo a passo das tarefas do dia a dia e das integrações. Para detalhes técnicos de
              integração via API, veja a{" "}
              <Link to="/docs/api" className="text-primary underline underline-offset-2">
                documentação da API
              </Link>
              .
            </>
          }
        >
          <FaixaEtapas etapas={ETAPAS_TOPO} rotulo="Como encontrar ajuda" />
          <Atalhos
            itens={[
              { id: "dia-a-dia", label: "Dia a dia" },
              { id: "integracoes", label: "Integrações" },
              { id: "suporte", label: "Falar com o suporte" },
            ]}
          />
        </HeroGlass>

        <section id="dia-a-dia" className={BLOCO_CINZA}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>Dia a dia</span>
              <h2 className={TITULO_SECAO}>Tarefas mais comuns na plataforma</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {diaADia.map((a) => (
                <CardGuia key={a.title} a={a} />
              ))}
            </div>
          </div>
        </section>

        <section id="integracoes" className={BLOCO_BRANCO}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>Integrações</span>
              <h2 className={TITULO_SECAO}>Conecte suas próprias contas</h2>
              <p className="text-sm text-muted-foreground">
                Cada corretor ou imobiliária usa as próprias credenciais — guias completos, passo a
                passo.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {integracoes.map((a) => (
                <CardGuia key={a.title} a={a} />
              ))}
            </div>
          </div>
        </section>

        <section id="suporte" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Suporte</span>
              <h2 className={TITULO_SECAO}>Não achou o que procurava?</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Abra um chamado na Central de Atendimento: você recebe um protocolo e acompanha a
                resposta, com prazo definido por prioridade (SLA).
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/atendimento"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  <Headset className="h-4 w-4" /> Abrir chamado
                </a>
                <a
                  href="mailto:contato@imob365.com.br"
                  className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
                >
                  <MessageSquare className="h-4 w-4" /> E-mail do suporte
                </a>
              </div>
            </div>
            <Fluxograma
              titulo="Caminho do suporte"
              legenda="Fluxo de suporte"
              etapas={FLUXO_SUPORTE}
              resultado="Problema resolvido, com histórico"
            />
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
