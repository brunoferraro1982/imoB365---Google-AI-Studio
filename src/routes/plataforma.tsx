import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  DollarSign,
  Megaphone,
  Scale,
  GraduationCap,
  Rocket,
  Users,
  Plug,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";

export const Route = createFileRoute("/plataforma")({
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/plataforma",
      title: "Plataforma e recursos — imob365",
      description:
        "Tudo que sua imobiliária recebe no imob365: gestão de imóveis e leads, financeiro, marketing multi-portal, jurídico e e-learning, numa única plataforma.",
    }),
  component: PlataformaPage,
});

const PILARES = [
  {
    icon: Building2,
    title: "Gestão completa de imóveis e leads",
    desc: "Cadastro, fotos, funil Kanban, histórico do lead, chat em tempo real, agendamento de visitas e comparação entre imóveis, tudo em um só painel.",
  },
  {
    icon: DollarSign,
    title: "Comissão calculada automaticamente, fechamento sem surpresa",
    desc: "Cálculo de comissão, centro de custo, plano de contas e relatórios financeiros num só lugar.",
  },
  {
    icon: Megaphone,
    title: "Publique uma vez, apareça em 7 portais",
    desc: "Feed automático para VivaReal, ZAP, Wimóveis, Chaves na Mão, Imovelweb, Mercado Livre e OLX, blog integrado, branding e site com a sua marca.",
  },
  {
    icon: Scale,
    title: "Contrato seguro, do modelo à assinatura",
    desc: "Biblioteca de modelos, geração automática, assinatura digital e checklist de documentação.",
  },
  {
    icon: GraduationCap,
    title: "Equipe treinada, resultado maior",
    desc: "Cursos e certificações para corretores hoje, com caminho futuro para credenciamento formal ao CRECI via curso de TTI direto na plataforma.",
  },
];

const E_TEM_MAIS = [
  {
    icon: Sparkles,
    title: "Assistente de IA especializado em imóveis",
    desc: "Pergunte sobre financiamento, ITBI, documentação e mercado imobiliário e receba resposta na hora, rodando em infraestrutura própria — sem depender de API paga de terceiro. Acesso ilimitado nos planos Pro e Business.",
  },
  {
    icon: Rocket,
    title: "Onboarding em minutos",
    desc: "Cadastre-se e comece a usar na hora, com 30 dias de teste completo, sem cartão de crédito.",
  },
  {
    icon: Users,
    title: "Portal para o seu cliente final",
    desc: "Favoritos, buscas salvas com alerta por e-mail e chat direto com o corretor, do lado do comprador/locatário.",
  },
  {
    icon: Plug,
    title: "API e webhooks",
    desc: "Para quem já tem um ecossistema próprio e quer integrar sem depender de suporte manual.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e compliance",
    desc: "Dados isolados por imobiliária, LGPD nativa e auditoria de ações sensíveis.",
  },
];

function PlataformaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_60%)]" />
        <div className="mx-auto max-w-4xl px-6 py-20 md:py-24 text-center">
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Tudo que sua imobiliária precisa, <span className="text-primary">em um só lugar</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Do primeiro lead ao contrato assinado, com o financeiro, o marketing e o jurídico
            integrados numa única plataforma.
          </p>
        </div>
      </section>

      {/* Pilares */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="space-y-5">
          {PILARES.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-start"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{p.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* E tem mais */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">E tem mais</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Recursos que sustentam a operação e a confiança em tudo o que você faz na plataforma.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {E_TEM_MAIS.map((m) => (
              <div key={m.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <m.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Pronto para ver a sua imobiliária em um só lugar?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Teste grátis por 30 dias no plano Business. Sem cartão de crédito.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg">Comece grátis</Button>
            </Link>
            <a href="mailto:contato@imob365.com.br">
              <Button size="lg" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" /> Falar com vendas
              </Button>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
