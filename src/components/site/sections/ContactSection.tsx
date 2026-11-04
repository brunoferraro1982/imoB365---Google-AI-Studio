import { useState, type FormEvent } from "react";
import { Loader2, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayoutKey } from "@/lib/siteSections";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";
import { mascaraTelefone, waHref } from "@/lib/tenantSite";
import { SecaoTitulo } from "./ui";

const CAMPO =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5";

export function ContactSection({
  ctx,
  compact,
}: {
  variant?: LayoutKey;
  ctx: SiteCtx;
  /** Renderização em 1 coluna, para área lateral (layout 'amplo'). */
  compact?: boolean;
}) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    mensagem: "",
    empresa: "",
  });
  const [sending, setSending] = useState(false);
  const wa = waHref(ctx, `Olá! Vim pelo site de ${ctx.tenantNome}.`);
  const s = ctx.settings;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.empresa) return;
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome");
    setSending(true);
    const { error } = await supabase.rpc(
      "public_create_tenant_lead" as never,
      {
        _tenant_slug: ctx.tenantSlug,
        _nome: form.nome.trim(),
        _email: form.email || "",
        _telefone: form.telefone || "",
        _mensagem: form.mensagem || "",
      } as never,
    );
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente o WhatsApp ou o e-mail ao lado.");
      return;
    }
    toast.success("Mensagem enviada! Em breve entraremos em contato.");
    setForm({ nome: "", email: "", telefone: "", mensagem: "", empresa: "" });
  }

  const canais = (
    <div className="space-y-3">
      {s.contato_telefone && (
        <a
          href={`tel:${s.contato_telefone.replace(/\D/g, "")}`}
          className="flex items-center gap-3 text-sm hover:text-primary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </span>
          {s.contato_telefone}
        </a>
      )}
      {s.contato_email && (
        <a
          href={`mailto:${s.contato_email}`}
          className="flex items-center gap-3 break-all text-sm hover:text-primary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          {s.contato_email}
        </a>
      )}
      {s.endereco && (
        <p className="flex items-center gap-3 text-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          {s.endereco}
        </p>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <div
      className={`glass-fosco grid gap-8 rounded-[32px] p-6 md:p-10 ${compact ? "" : "md:grid-cols-[1fr_1.2fr]"}`}
    >
      <div>
        <SecaoTitulo
          compact={compact}
          eyebrow="Contato"
          titulo={ctx.tipoTenant === "corretor" ? "Fale comigo" : "Fale com a gente"}
          subtitulo="Tem uma dúvida ou quer agendar uma visita? Mande uma mensagem ou fale direto pelos canais abaixo."
        />
        {canais}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          name="empresa"
          tabIndex={-1}
          autoComplete="off"
          value={form.empresa}
          onChange={(e) => setForm({ ...form, empresa: e.target.value })}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          aria-hidden
        />
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          <input
            className={CAMPO}
            placeholder="Seu nome"
            aria-label="Seu nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            maxLength={200}
            required
          />
          <input
            className={CAMPO}
            placeholder="WhatsApp com DDD"
            aria-label="Telefone"
            inputMode="tel"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
          />
        </div>
        <input
          className={CAMPO}
          type="email"
          placeholder="E-mail"
          aria-label="E-mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          maxLength={255}
        />
        <textarea
          className={`${CAMPO} min-h-[120px] resize-y`}
          placeholder={
            ctx.tipoTenant === "corretor" ? "Como posso ajudar?" : "Como podemos ajudar?"
          }
          aria-label="Mensagem"
          value={form.mensagem}
          onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Enviando…" : "Enviar mensagem"}
        </button>
      </form>
    </div>
  );
}
