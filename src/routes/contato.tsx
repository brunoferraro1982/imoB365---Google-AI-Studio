import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  ArrowRight,
  Clock,
  Star,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | imoB365 — Consultoria Imobiliária" },
      {
        name: "description",
        content:
          "Entre em contato com a imoB365. Atendimento 365 dias por ano em Santos, Praia Grande e São Vicente.",
      },
    ],
  }),
  component: ContatoPage,
});

const CONTATOS = [
  {
    icon: Phone,
    titulo: "Telefone",
    desc: "(13) 99779-4382",
    href: "tel:+5513997794382",
    color: "bg-blue-100/70 text-blue-800",
  },
  {
    icon: Mail,
    titulo: "E-mail",
    desc: "contato@imob365.com.br",
    href: "mailto:contato@imob365.com.br",
    color: "bg-purple-100/70 text-purple-800",
  },
  {
    icon: MapPin,
    titulo: "Região Atendida",
    desc: "Praia Grande · Santos · São Vicente, SP",
    href: null,
    color: "bg-primary/10 text-primary",
  },
  {
    icon: MessageCircle,
    titulo: "WhatsApp",
    desc: "Disponível 365 dias por ano",
    href: "https://wa.me/5513997794382",
    color: "bg-emerald-100/70 text-emerald-800",
  },
];

const STATS = [
  { valor: "2h", label: "Tempo médio de resposta", icon: Clock },
  { valor: "365", label: "Dias por ano atendendo", icon: Star },
  { valor: "3", label: "Cidades no Litoral Sul", icon: MapPin },
  { valor: "100%", label: "Foco no seu atendimento", icon: ShieldCheck },
];

function ContatoPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aceite, setAceite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aceite) {
      toast.error("Aceite a política de privacidade para continuar.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leads").insert({
      nome,
      email,
      telefone: telefone || null,
      mensagem,
      origem: "contato",
      status: "novo",
    } as any);
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar. Tente novamente.");
      return;
    }
    setDone(true);
    toast.success("Mensagem enviada! Retornaremos em breve.");
  }

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">
        {/* ─── HERO ───────────────────────────────────────────────── */}
        <section
          id="hero"
          className="relative py-20 px-4 bg-gradient-to-b from-neutral-950 via-neutral-900 to-background overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle at 25px 25px, white 2px, transparent 0)",
              backgroundSize: "50px 50px",
            }}
          />

          <div className="container max-w-4xl mx-auto text-center space-y-6 relative z-10">
            <span className="inline-block bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-primary/30">
              Fale Conosco
            </span>
            <p className="text-white/60 text-sm font-semibold uppercase tracking-widest">
              Atendimento 365 dias por ano
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Vamos Conversar Sobre
              <br />
              <span className="text-primary">o Seu Próximo Patrimônio.</span>
            </h1>
            <p className="text-white/65 leading-relaxed max-w-2xl mx-auto text-sm sm:text-base">
              Nossa equipe especializada no mercado de alto padrão do Litoral Sul retorna em até 2
              horas nos dias úteis. Conte pra gente o que você procura.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <a
                href="#formulario"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
              >
                Enviar mensagem <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5513997794382"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors"
              >
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* ─── CANAIS DE CONTATO ──────────────────────────────────── */}
        <section id="canais" className="py-16 px-4 scroll-mt-20">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Canais de Atendimento
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Estamos Prontos para Te Atender
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CONTATOS.map((c) => (
                <div
                  key={c.titulo}
                  className="rounded-2xl border border-border/60 bg-card p-6 space-y-3"
                >
                  <div
                    className={`h-10 w-10 rounded-xl ${c.color} flex items-center justify-center`}
                  >
                    <c.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-wide">{c.titulo}</h3>
                  {c.href ? (
                    <a
                      href={c.href}
                      target={c.href.startsWith("http") ? "_blank" : undefined}
                      rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="text-xs text-muted-foreground leading-relaxed hover:text-primary transition-colors block"
                    >
                      {c.desc}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── NÚMEROS ─────────────────────────────────────────────── */}
        <section className="py-14 bg-primary text-white">
          <div className="container max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                Por que falar com a gente
              </p>
              <h2 className="text-xl font-black">Compromisso com a sua resposta</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {STATS.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-center mb-2">
                    <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <s.icon className="h-5 w-5 text-white/80" />
                    </div>
                  </div>
                  <p className="text-3xl font-black">{s.valor}</p>
                  <p className="text-xs text-white/70 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FORMULÁRIO ──────────────────────────────────────────── */}
        <section id="formulario" className="py-16 px-4 bg-muted/20 scroll-mt-20">
          <div className="container max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Envie sua Mensagem
              </span>
              <h2 className="text-2xl font-black tracking-tight">
                Conte pra Gente o que Você Procura
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Preencha o formulário abaixo e nossa equipe retorna em até 2 horas nos dias úteis.
              </p>
            </div>

            {done ? (
              <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card p-10 text-center">
                <div className="space-y-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-100/70 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  </div>
                  <p className="font-bold">Mensagem enviada!</p>
                  <p className="text-sm text-muted-foreground">
                    Retornaremos em breve para {email}.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 md:p-8"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="ct-nome"
                      className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                    >
                      Nome *
                    </Label>
                    <Input
                      id="ct-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      placeholder="Seu nome"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="ct-email"
                      className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                    >
                      E-mail *
                    </Label>
                    <Input
                      id="ct-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="ct-tel"
                    className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                  >
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="ct-tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(13) 99999-9999"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="ct-msg"
                    className="text-xs font-bold uppercase text-muted-foreground tracking-wider"
                  >
                    Mensagem *
                  </Label>
                  <textarea
                    id="ct-msg"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    required
                    rows={4}
                    placeholder="Como podemos te ajudar?"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="ct-aceite"
                    checked={aceite}
                    onChange={(e) => setAceite(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="ct-aceite"
                    className="text-[11px] text-muted-foreground leading-relaxed"
                  >
                    Li e aceito a{" "}
                    <a href="/politica-de-privacidade" className="text-primary underline">
                      Política de Privacidade
                    </a>{" "}
                    e concordo em ser contatado pela imoB365.
                  </label>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !aceite}
                  className="w-full font-bold h-9"
                >
                  {loading ? "Enviando..." : "Enviar Mensagem"}
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* ─── CTA FINAL ───────────────────────────────────────────── */}
        <section className="py-16 px-4 text-center bg-gradient-to-b from-background to-muted/40">
          <div className="container max-w-2xl mx-auto space-y-4">
            <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              Ainda com dúvidas?
            </span>
            <h2 className="text-2xl font-black tracking-tight">Conheça mais sobre a imoB365</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Descubra nossa missão, valores e como atuamos no Litoral Sul de São Paulo.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                to="/a-imob365"
                hash="quem-somos"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
              >
                Conheça a imoB365 <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://wa.me/5513997794382"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-bold hover:bg-muted transition-colors"
              >
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
              <Link
                to="/buscar"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-bold hover:bg-muted transition-colors"
              >
                Ver Imóveis
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
