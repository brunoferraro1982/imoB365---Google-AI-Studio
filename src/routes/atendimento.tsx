import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Headset,
  HelpCircle,
  Inbox,
  Mail,
  MessageCircle,
  MessagesSquare,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  Timer,
  UserCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { AtendimentoWidget } from "@/components/atendimento/AtendimentoWidget";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/chamadosLabels";

export const Route = createFileRoute("/atendimento")({
  head: () => ({
    meta: [
      { title: "Central de Atendimento | imoB365" },
      {
        name: "description",
        content:
          "Abra ou acompanhe um chamado com a imoB365: protocolo, prioridade e prazo de resposta definido (SLA) em cada etapa.",
      },
    ],
  }),
  component: AtendimentoPage,
});

type ChamadoAcompanhamento = {
  numero: string;
  assunto: string;
  status: string;
  created_at: string;
  mensagens: { autor_tipo: string; conteudo: string; created_at: string }[];
};

function AcompanharChamado() {
  const [numero, setNumero] = useState("");
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ChamadoAcompanhamento | null>(null);

  async function buscar() {
    if (!numero.trim() || !email.trim()) {
      toast.error("Informe o número do chamado e o e-mail usado na abertura.");
      return;
    }
    setBuscando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.rpc("public_buscar_chamado", {
        _numero: numero.trim().toUpperCase(),
        _email: email.trim(),
      });
      if (error) throw error;
      setResultado(data as unknown as ChamadoAcompanhamento);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chamado não encontrado");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Número do chamado (CH-000123)"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="h-10 min-w-[180px] flex-1 bg-white/80 dark:bg-white/5"
        />
        <Input
          type="email"
          placeholder="E-mail usado na abertura"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 min-w-[180px] flex-1 bg-white/80 dark:bg-white/5"
        />
        <Button onClick={buscar} disabled={buscando} className="h-10 rounded-full px-5">
          <Search className="mr-1 h-4 w-4" />
          Buscar
        </Button>
      </div>

      {resultado && (
        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{resultado.assunto}</p>
              <p className="text-xs text-muted-foreground">
                {resultado.numero} · {new Date(resultado.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[resultado.status]}>
              {STATUS_LABEL[resultado.status]}
            </Badge>
          </div>
          <div className="space-y-2">
            {resultado.mensagens.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl p-3 text-sm ${m.autor_tipo === "agente" ? "bg-primary/10" : "bg-white/70 dark:bg-white/5"}`}
              >
                <div className="mb-1 text-xs text-muted-foreground">
                  {m.autor_tipo === "agente" ? "Nossa equipe" : "Você"} ·{" "}
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                </div>
                {m.conteudo}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Etapas reais de um chamado (status da Central: novo → em atendimento →
// aguardando cliente → resolvido/fechado). SLA varia por prioridade — sem
// prometer números aqui.
const MACRO: Etapa[] = [
  { icon: Inbox, titulo: "Abertura", texto: "" },
  { icon: ClipboardList, titulo: "Triagem", texto: "" },
  { icon: UserCheck, titulo: "Atendimento", texto: "" },
  { icon: MessagesSquare, titulo: "Resposta", texto: "" },
  { icon: BadgeCheck, titulo: "Resolvido", texto: "" },
];

const FLUXO: Etapa[] = [
  { icon: Inbox, titulo: "Abertura", texto: "Você recebe o protocolo CH-…" },
  { icon: ClipboardList, titulo: "Triagem", texto: "Categoria e prioridade definidas" },
  { icon: UserCheck, titulo: "Atendimento", texto: "Especialista assume o caso" },
  { icon: Bell, titulo: "Resposta", texto: "Aviso por e-mail a cada retorno" },
];

const CATEGORIAS = [
  {
    icon: MonitorSmartphone,
    titulo: "Problema na plataforma",
    texto: "Erros, acesso ou funcionamento do portal e do painel.",
    cor: "bg-blue-100/80 text-blue-800",
  },
  {
    icon: HelpCircle,
    titulo: "Dúvida comercial",
    texto: "Planos, imóveis, consultoria e parcerias.",
    cor: "bg-primary/10 text-primary",
  },
  {
    icon: FileWarning,
    titulo: "Reclamação sobre anúncio",
    texto: "Informação incorreta ou anúncio irregular.",
    cor: "bg-rose-100/80 text-rose-800",
  },
  {
    icon: CircleDollarSign,
    titulo: "Financeiro / cobrança",
    texto: "Faturas, pagamentos e assinatura.",
    cor: "bg-emerald-100/80 text-emerald-800",
  },
];

const CANAIS = [
  {
    icon: MessagesSquare,
    titulo: "Chat do site",
    texto: "No ícone de atendimento, em qualquer página",
  },
  { icon: ClipboardList, titulo: "Formulário", texto: "Nesta página ou em /contato" },
  { icon: Mail, titulo: "E-mail", texto: "contato@imob365.com.br" },
  { icon: MessageCircle, titulo: "WhatsApp", texto: "(13) 99779-4382" },
];

const BLOCO_BRANCO = "relative scroll-mt-24 bg-white px-4 py-10 md:py-12 dark:bg-[#0b1220]";
const BLOCO_CINZA =
  "relative scroll-mt-24 bg-gradient-to-b from-[#f3f4f6] to-[#eef0f3] px-4 py-10 md:py-12 dark:from-[#0f172a] dark:to-[#0f172a]";
const CARD =
  "rounded-3xl border border-black/5 bg-white/80 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5";
const SELO =
  "inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-wide text-primary";

const ATALHOS = [
  { id: "abrir", label: "Abrir chamado" },
  { id: "acompanhar", label: "Acompanhar chamado" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "tipos", label: "Tipos de atendimento" },
];

function AtendimentoPage() {
  return (
    <>
      <SiteHeader />
      <div className="hero-brand min-h-screen bg-white dark:bg-[#0b1220]">
        {/* ─── TOPO ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white px-4 pb-8 pt-8 md:pt-10 dark:bg-[#0b1220]">
          <div aria-hidden className="mesh-brand-claro pointer-events-none absolute inset-0" />
          <div className="glass-fosco relative mx-auto max-w-6xl space-y-5 rounded-[28px] px-6 py-9 text-center md:px-10 md:py-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              <Headset className="h-3.5 w-3.5" /> Central de Atendimento
            </span>
            <h1 className="font-brand-display text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Como podemos ajudar?{" "}
              <span className="text-primary">Cada chamado com protocolo e prazo definido.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Abra um chamado novo ou acompanhe um já existente pelo número e o e-mail usados na
              abertura.
            </p>
            <ol
              className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 pt-1"
              aria-label="Etapas de um chamado"
            >
              {MACRO.map((e, i) => (
                <li key={e.titulo} className="flex items-center gap-1.5">
                  <span className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm dark:border-white/10 dark:bg-white/10">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                      <e.icon className="h-3.5 w-3.5" />
                    </span>
                    {e.titulo}
                  </span>
                  {i < MACRO.length - 1 && <ArrowRight className="h-4 w-4 text-primary/70" />}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {ATALHOS.map((a) => (
                <a
                  key={a.id}
                  href={`#${a.id}`}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                >
                  {a.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ABRIR (50%) + ACOMPANHAR (50%) — cinza ──────────────── */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div id="abrir" className={`${CARD} scroll-mt-24 p-6 md:p-8`}>
              <span className={SELO}>Novo chamado</span>
              <h2 className="font-brand-display mt-3 text-2xl font-extrabold tracking-tight">
                Abrir novo chamado
              </h2>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">
                Você recebe o número do protocolo na hora e a confirmação por e-mail.
              </p>
              <AtendimentoWidget />
            </div>
            <div id="acompanhar" className={`${CARD} flex scroll-mt-24 flex-col p-6 md:p-8`}>
              <span className={`${SELO} self-start`}>Já tenho protocolo</span>
              <h2 className="font-brand-display mt-3 text-2xl font-extrabold tracking-tight">
                Acompanhar chamado
              </h2>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">
                Informe o número (CH-…) e o e-mail usado na abertura para ver o status e as
                respostas.
              </p>
              <AcompanharChamado />
              <div className="mt-auto pt-6">
                <p className="mb-3 text-sm font-bold">O que significa cada status</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {[
                    { s: "Novo", d: "Recebido, aguardando triagem", c: "bg-rose-500" },
                    { s: "Em atendimento", d: "Um especialista está no caso", c: "bg-primary" },
                    {
                      s: "Aguardando cliente",
                      d: "Precisamos de uma informação sua",
                      c: "bg-amber-500",
                    },
                    { s: "Resolvido", d: "Solução enviada para você", c: "bg-emerald-500" },
                    { s: "Fechado", d: "Concluído e arquivado no histórico", c: "bg-slate-400" },
                  ].map((i) => (
                    <li
                      key={i.s}
                      className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3 dark:bg-white/5"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.c}`} />
                      <span>
                        <span className="block text-xs font-bold">{i.s}</span>
                        <span className="block text-[11px] text-muted-foreground">{i.d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── COMO FUNCIONA (texto 50% + fluxograma 50%) — branco ─── */}
        <section id="como-funciona" className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Como funciona</span>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                Seu chamado, do protocolo à solução
              </h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Toda solicitação vira um chamado com número de protocolo. A equipe classifica a
                categoria e a prioridade, e cada prioridade tem um prazo de resposta definido (SLA)
                que acompanhamos de perto.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  { icon: BadgeCheck, t: "Protocolo único por chamado" },
                  { icon: Timer, t: "Prazo de resposta por prioridade" },
                  { icon: Bell, t: "Aviso por e-mail a cada resposta" },
                  { icon: ShieldCheck, t: "Histórico completo e seguro" },
                ].map((i) => (
                  <li key={i.t} className="flex items-center gap-2 text-xs text-foreground/85">
                    <i.icon className="h-4 w-4 shrink-0 text-primary" />
                    {i.t}
                  </li>
                ))}
              </ul>
            </div>
            <Fluxograma
              titulo="Atendimento de um chamado"
              legenda="Fluxo do chamado"
              etapas={FLUXO}
              resultado="Chamado resolvido, com tudo registrado"
            />
          </div>
        </section>

        {/* ─── TIPOS (50%) + CANAIS (50%) — cinza ─────────────────── */}
        <section id="tipos" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className={`${CARD} p-6 md:p-8`}>
              <span className={SELO}>Tipos de atendimento</span>
              <h2 className="font-brand-display mt-3 text-2xl font-extrabold tracking-tight">
                Com o que podemos ajudar
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {CATEGORIAS.map((c) => (
                  <div key={c.titulo} className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.cor}`}>
                      <c.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-2 text-sm font-bold">{c.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{c.texto}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${CARD} p-6 md:p-8`}>
              <span className={SELO}>Canais</span>
              <h2 className="font-brand-display mt-3 text-2xl font-extrabold tracking-tight">
                Fale pelo canal que preferir
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos os canais abrem um chamado na Central — você acompanha tudo pelo mesmo
                protocolo.
              </p>
              <ul className="mt-5 space-y-3">
                {CANAIS.map((c) => (
                  <li
                    key={c.titulo}
                    className="flex items-center gap-3 rounded-2xl bg-white/70 p-3.5 dark:bg-white/5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{c.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{c.texto}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL (branco, compacto) ───────────────────────── */}
        <section className={BLOCO_BRANCO}>
          <div
            className={`${CARD} mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-center md:flex-row md:text-left`}
          >
            <div>
              <p className="font-brand-display text-lg font-extrabold">Prefere falar agora?</p>
              <p className="text-sm text-muted-foreground">
                Chame no WhatsApp ou envie uma mensagem pela página de contato.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href="https://wa.me/5513997794382?text=Ol%C3%A1!%20Vim%20pela%20Central%20de%20Atendimento%20da%20imoB365."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <Link
                to="/contato"
                className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                Página de contato <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
