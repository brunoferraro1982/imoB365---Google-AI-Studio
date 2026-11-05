import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, Mail, Globe, Headset, ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";
// Foto livre (Unsplash License, autor Vagaro) já desfocada no próprio
// arquivo — o desfoque é parte da imagem, não só CSS.
import fotoAtendimento from "@/assets/images/contato-atendimento.jpg";

export const Route = createFileRoute("/contato")({
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/contato",
      title: "Contato | imoB365 — Consultoria Imobiliária",
      description: "Entre em contato com a imoB365. Atendimento 365 dias por ano em todo o Brasil.",
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
    icon: Globe,
    titulo: "Atendimento",
    desc: "Todo o Brasil, 365 dias por ano",
    href: null,
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Headset,
    titulo: "Central de atendimento",
    desc: "Abra um chamado com nossa equipe",
    href: "/atendimento",
    color: "bg-emerald-100/70 text-emerald-800",
  },
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
    // Antes chamava public_create_tenant_lead fixo no tenant "imob365" —
    // agora vira um chamado real na Central de Atendimento, sem contexto
    // de imóvel/corretor (cai no balcão imoB365 pra triagem, decisão
    // confirmada no plano da Central de Atendimento).
    const { error } = await supabase.rpc("public_create_chamado", {
      _nome: nome,
      _email: email,
      _telefone: telefone,
      _mensagem: mensagem,
      _categoria: "duvida_comercial",
    });
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
      <div className="hero-brand relative min-h-screen bg-[#f6f7f9] dark:bg-[#0b1220]">
        <div aria-hidden className="mesh-brand-claro pointer-events-none absolute inset-0" />

        {/* ─── TOPO: foto de atendimento desfocada + vidro ─────────── */}
        <section id="hero" className="relative overflow-hidden px-4 pb-10 pt-8 md:pb-12 md:pt-10">
          <img
            src={fotoAtendimento}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-105 object-cover object-[70%_40%] dark:opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/20 to-transparent dark:from-[#0b1220]/80 dark:via-[#0b1220]/50 dark:to-[#0b1220]/30" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#f6f7f9] dark:to-[#0b1220]" />
          <div className="relative mx-auto max-w-6xl md:py-6">
            <div className="glass-fosco space-y-4 rounded-[28px] px-6 py-8 text-center md:max-w-xl md:px-9 md:text-left">
              <span className="inline-block rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                Fale Conosco
              </span>
              <h1 className="font-brand-display text-[1.9rem] font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
                Vamos conversar sobre o seu{" "}
                <span className="text-primary">próximo patrimônio.</span>
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:mx-0">
                Atendimento 365 dias por ano. Nossa equipe retorna em até 2 horas nos dias úteis —
                conte pra gente o que você procura.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-1 md:justify-start">
                <a
                  href="#formulario"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition hover:bg-primary/90"
                >
                  Enviar mensagem <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/atendimento"
                  className="glass-claro inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-foreground transition hover:bg-white/60"
                >
                  <Headset className="h-4 w-4" /> Central de atendimento
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CANAIS (50%) + FORMULÁRIO (50%) ─────────────────────── */}
        <section className="relative px-4 pb-10">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            <div
              id="canais"
              className="glass-fosco flex scroll-mt-24 flex-col rounded-[28px] p-6 md:p-8"
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                Canais de atendimento
              </p>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                Estamos prontos para te atender
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha o canal que for mais prático para você.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {CONTATOS.map((c) => {
                  const conteudo = (
                    <>
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${c.color}`}
                      >
                        <c.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{c.titulo}</span>
                        <span className="mt-0.5 block break-words text-xs leading-relaxed text-muted-foreground">
                          {c.desc}
                        </span>
                      </span>
                    </>
                  );
                  const cls =
                    "flex items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 transition dark:border-white/10 dark:bg-white/5";
                  return c.href ? (
                    <a
                      key={c.titulo}
                      href={c.href}
                      className={`${cls} hover:-translate-y-0.5 hover:bg-white`}
                    >
                      {conteudo}
                    </a>
                  ) : (
                    <div key={c.titulo} className={cls}>
                      {conteudo}
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto pt-5">
                <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-[#0f1e3a] to-[#1b2f57] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-brand-display text-base font-extrabold">
                      Prefere falar agora?
                    </p>
                    <p className="text-xs text-white/70">
                      Abra um chamado e acompanhe a resposta da nossa equipe, todos os dias.
                    </p>
                  </div>
                  <a
                    href="/atendimento"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0f1e3a] transition hover:bg-white/90"
                  >
                    <Headset className="h-4 w-4" /> Abrir chamado
                  </a>
                </div>
              </div>
            </div>

            <div id="formulario" className="glass-fosco scroll-mt-24 rounded-[28px] p-6 md:p-8">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                Envie sua mensagem
              </p>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                Conte pra gente o que você procura
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nossa equipe retorna em até 2 horas nos dias úteis.
              </p>

              {done ? (
                <div className="mt-6 flex items-center justify-center rounded-2xl bg-white/60 p-10 text-center dark:bg-white/5">
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/70">
                      <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                    </div>
                    <p className="font-bold">Mensagem enviada!</p>
                    <p className="text-sm text-muted-foreground">
                      Retornaremos em breve para {email}.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="ct-nome"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Nome *
                      </Label>
                      <Input
                        id="ct-nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        placeholder="Seu nome"
                        className="h-10 bg-white/80 dark:bg-white/5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="ct-email"
                        className="text-xs font-semibold text-muted-foreground"
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
                        className="h-10 bg-white/80 dark:bg-white/5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ct-tel" className="text-xs font-semibold text-muted-foreground">
                      Telefone / WhatsApp
                    </Label>
                    <Input
                      id="ct-tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(13) 99999-9999"
                      className="h-10 bg-white/80 dark:bg-white/5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ct-msg" className="text-xs font-semibold text-muted-foreground">
                      Mensagem *
                    </Label>
                    <textarea
                      id="ct-msg"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      required
                      rows={3}
                      placeholder="Como podemos te ajudar?"
                      className="w-full resize-none rounded-md border border-input bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-white/5"
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
                      className="text-[11px] leading-relaxed text-muted-foreground"
                    >
                      Li e aceito a{" "}
                      <a href="/privacidade" className="text-primary underline">
                        Política de Privacidade
                      </a>{" "}
                      e concordo em ser contatado pela imoB365.
                    </label>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || !aceite}
                    className="h-10 w-full rounded-full font-bold"
                  >
                    {loading ? "Enviando..." : "Enviar mensagem"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL (compacto) ────────────────────────────────── */}
        <section className="relative px-4 pb-14">
          <div className="glass-fosco mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 rounded-[28px] px-6 py-6 text-center md:flex-row md:text-left">
            <div>
              <p className="font-brand-display text-lg font-extrabold">Ainda com dúvidas?</p>
              <p className="text-sm text-muted-foreground">
                Conheça nossa missão, nossos valores e como atuamos em todo o Brasil.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/a-imob365"
                hash="quem-somos"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Conheça a imoB365 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/buscar"
                className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                Ver imóveis
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
