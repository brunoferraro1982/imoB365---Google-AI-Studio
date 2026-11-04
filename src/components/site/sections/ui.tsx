import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Handshake,
  Heart,
  Home,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import { mascaraTelefone, waHref } from "@/lib/tenantSite";

/** Ícones disponíveis para os blocos editáveis (chave salva no banco). */
export const ICONES_SITE = {
  shield: ShieldCheck,
  search: Search,
  file: FileText,
  key: KeyRound,
  home: Home,
  handshake: Handshake,
  star: Star,
  heart: Heart,
  users: Users,
  trending: TrendingUp,
  map: MapPin,
  calendar: CalendarCheck,
  building: Building2,
  sparkles: Sparkles,
  badge: BadgeCheck,
} as const;
export type IconeSite = keyof typeof ICONES_SITE;
export function iconeSite(k: string | undefined) {
  return ICONES_SITE[(k as IconeSite) ?? "sparkles"] ?? Sparkles;
}

export function SecaoTitulo({
  eyebrow,
  titulo,
  subtitulo,
  acao,
  claro,
  compact,
}: {
  eyebrow?: string;
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  claro?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={`mb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${claro ? "text-white/60" : "text-primary"}`}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={`font-brand-display font-extrabold tracking-tight ${
            compact ? "text-lg" : "text-[1.75rem] leading-tight md:text-4xl"
          } ${claro ? "text-white" : "text-foreground"}`}
        >
          {titulo}
        </h2>
        {subtitulo && !compact && (
          <p
            className={`mt-2 max-w-2xl text-[15px] ${claro ? "text-white/70" : "text-muted-foreground"}`}
          >
            {subtitulo}
          </p>
        )}
      </div>
      {acao}
    </div>
  );
}

const INTERESSES = ["Comprar", "Alugar", "Investir"] as const;
const TIPOS = ["Apartamento", "Casa", "Lançamento", "Terreno", "Comercial"];
const PRAZOS = ["O quanto antes", "Em até 3 meses", "Em até 6 meses", "Só pesquisando"];

/**
 * Formulário de lead do site do tenant — cai no CRM do próprio tenant via
 * `public_create_tenant_lead` (origem 'site', distribuição round-robin). Os
 * campos extras (interesse, tipo, prazo) vão compostos na mensagem; o
 * honeypot "empresa" descarta robôs sem gravar nada.
 */
export function FormLeadSite({
  ctx,
  titulo = "Receba opções no seu WhatsApp",
  subtitulo = "Conte o que procura — resposta rápida, sem compromisso.",
  escuro,
  id = "receber-opcoes",
}: {
  ctx: SiteCtx;
  titulo?: string;
  subtitulo?: string;
  escuro?: boolean;
  id?: string;
}) {
  const [f, setF] = useState({
    nome: "",
    telefone: "",
    email: "",
    interesse: "Comprar" as (typeof INTERESSES)[number],
    tipo: "",
    prazo: "",
    empresa: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome} e quero receber opções.`);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (f.empresa) {
      setEnviado(true);
      return;
    }
    if (f.nome.trim().length < 2) return toast.error("Informe seu nome");
    if (f.telefone.replace(/\D/g, "").length < 10 && !f.email.includes("@"))
      return toast.error("Informe um WhatsApp ou e-mail para retorno");
    setEnviando(true);
    const mensagem = [
      `Interesse: ${f.interesse}`,
      f.tipo && `Tipo: ${f.tipo}`,
      f.prazo && `Prazo: ${f.prazo}`,
      "Origem: formulário do topo do site",
    ]
      .filter(Boolean)
      .join(" · ");
    const { error } = await supabase.rpc(
      "public_create_tenant_lead" as never,
      {
        _tenant_slug: ctx.tenantSlug,
        _nome: f.nome.trim(),
        _email: f.email.trim(),
        _telefone: f.telefone,
        _mensagem: mensagem,
      } as never,
    );
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente pelo WhatsApp.");
      return;
    }
    setEnviado(true);
    toast.success("Recebemos seu contato! Em breve falamos com você.");
  }

  const campo = escuro
    ? "w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/50 outline-none transition focus:border-white/40 focus:bg-white/15"
    : "w-full rounded-xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5";

  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-[28px] p-5 md:p-6 ${escuro ? "glass-escuro text-white" : "glass-fosco"}`}
    >
      {enviado ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="font-brand-display mt-3 text-xl font-extrabold">Contato recebido!</p>
          <p className={`mt-1 text-sm ${escuro ? "text-white/70" : "text-muted-foreground"}`}>
            {ctx.tenantNome} vai falar com você em breve.
          </p>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Adiantar pelo WhatsApp
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div className="mb-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Atendimento gratuito
            </p>
            <p className="font-brand-display mt-1 text-lg font-extrabold leading-snug">{titulo}</p>
            <p className={`mt-0.5 text-xs ${escuro ? "text-white/65" : "text-muted-foreground"}`}>
              {subtitulo}
            </p>
          </div>
          {/* honeypot: invisível para humanos */}
          <input
            type="text"
            name="empresa"
            tabIndex={-1}
            autoComplete="off"
            value={f.empresa}
            onChange={(e) => setF({ ...f, empresa: e.target.value })}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            aria-hidden
          />
          <input
            className={campo}
            placeholder="Seu nome"
            value={f.nome}
            maxLength={120}
            onChange={(e) => setF({ ...f, nome: e.target.value })}
            aria-label="Seu nome"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={campo}
              placeholder="WhatsApp com DDD"
              inputMode="tel"
              value={f.telefone}
              onChange={(e) => setF({ ...f, telefone: mascaraTelefone(e.target.value) })}
              aria-label="WhatsApp com DDD"
            />
            <input
              className={campo}
              placeholder="E-mail (opcional)"
              type="email"
              maxLength={200}
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              aria-label="E-mail"
            />
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Interesse">
            {INTERESSES.map((i) => {
              const ativo = f.interesse === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setF({ ...f, interesse: i })}
                  className={`rounded-xl border px-2 py-2 text-[13px] font-semibold transition ${
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : escuro
                        ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                        : "border-black/10 bg-white/60 text-foreground/80 hover:bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  {i}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className={campo}
              value={f.tipo}
              onChange={(e) => setF({ ...f, tipo: e.target.value })}
              aria-label="Tipo de imóvel"
            >
              <option value="">Tipo de imóvel</option>
              {TIPOS.map((t) => (
                <option key={t} value={t} className="text-foreground">
                  {t}
                </option>
              ))}
            </select>
            <select
              className={campo}
              value={f.prazo}
              onChange={(e) => setF({ ...f, prazo: e.target.value })}
              aria-label="Quando pretende"
            >
              <option value="">Quando pretende?</option>
              {PRAZOS.map((t) => (
                <option key={t} value={t} className="text-foreground">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Quero receber opções
          </button>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                escuro
                  ? "border-[#25D366]/50 text-[#5ee08f] hover:bg-[#25D366]/10"
                  : "border-[#25D366]/40 text-[#128C4B] hover:bg-[#25D366]/10"
              }`}
            >
              <MessageCircle className="h-4 w-4" /> Prefiro chamar no WhatsApp
            </a>
          )}
          <p
            className={`text-center text-[11px] ${escuro ? "text-white/45" : "text-muted-foreground"}`}
          >
            Seus dados são usados só para este atendimento.
          </p>
        </form>
      )}
    </div>
  );
}

/**
 * Barra fixa no rodapé do celular (abaixo de md): WhatsApp + receber opções.
 * `alvo` é o id do formulário na própria página ou um caminho completo
 * (rotas filhas apontam para o formulário da home).
 */
export function MobileCtaBar({ ctx, alvo }: { ctx: SiteCtx; alvo: string }) {
  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/80 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/10 dark:bg-[#0b1220]/80 md:hidden">
      <div className="flex gap-2 pr-16">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2.5 text-[13px] font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        <a
          href={alvo.startsWith("/") ? alvo : `#${alvo}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2.5 text-[13px] font-bold text-primary-foreground"
        >
          Receber opções
        </a>
      </div>
    </div>
  );
}
