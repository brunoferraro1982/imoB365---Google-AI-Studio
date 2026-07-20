import { useState, type FormEvent } from "react";
import { Phone, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayoutKey } from "@/lib/siteSections";
import type { SiteCtx } from "@/components/site/TenantSiteLayout";

export function ContactSection({
  variant,
  ctx,
  compact,
}: {
  variant: LayoutKey;
  ctx: SiteCtx;
  /** Renderização em 1 coluna e sem container próprio, para área lateral (layout 'amplo'). */
  compact?: boolean;
}) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [sending, setSending] = useState(false);
  const waHref = ctx.settings.contato_whatsapp
    ? `https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome");
    setSending(true);
    const { error } = await supabase.rpc("public_create_tenant_lead" as any, {
      _tenant_slug: ctx.tenantSlug,
      _nome: form.nome.trim(),
      _email: form.email || "",
      _telefone: form.telefone || "",
      _mensagem: form.mensagem || "",
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente o WhatsApp ou email do rodapé.");
      return;
    }
    toast.success("Mensagem enviada! Em breve entraremos em contato.");
    setForm({ nome: "", email: "", telefone: "", mensagem: "" });
  }

  const containerClass = compact
    ? "grid gap-8"
    : variant === "boutique"
      ? "mx-auto grid max-w-3xl gap-12 px-6 py-24"
      : "mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.2fr]";

  const Wrapper = compact ? "div" : "section";

  return (
    <Wrapper className={compact ? undefined : "border-t border-border"}>
      <div className={containerClass}>
        <div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">Fale com a gente</h2>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Tem alguma dúvida ou quer agendar uma visita? Preencha o formulário ou fale direto pelos
            canais abaixo.
          </p>
          <div className="space-y-4">
            {ctx.settings.contato_telefone && (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="h-4 w-4" />
                </span>
                {ctx.settings.contato_telefone}
              </div>
            )}
            {ctx.settings.contato_email && (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </span>
                {ctx.settings.contato_email}
              </div>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="mt-2 gap-2 rounded-full">
                  <MessageCircle className="h-4 w-4" />
                  Chamar no WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Telefone
              </Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Mensagem</Label>
            <Textarea
              rows={4}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={sending} className="w-full gap-2 rounded-full">
            <Send className="h-4 w-4" />
            {sending ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </form>
      </div>
    </Wrapper>
  );
}
