import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  DollarSign,
  Megaphone,
  Scale,
  GraduationCap,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/ajuda")({
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
];

function AjudaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_60%)]" />
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-24 text-center">
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Central de <span className="text-primary">Ajuda</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Guias rápidos por jornada. Para detalhes técnicos de integração via API, veja a{" "}
            <Link to="/docs/api" className="text-primary underline underline-offset-2">
              documentação da API
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="space-y-5">
          {ARTIGOS.map((a) => (
            <div key={a.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <a.icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold">{a.title}</h2>
              </div>
              <ol className="mt-4 space-y-2.5 border-t border-border pt-4">
                {a.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Não achou o que procurava?
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
