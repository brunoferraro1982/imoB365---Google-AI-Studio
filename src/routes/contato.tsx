import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | imoB365 — Consultoria Imobiliária" },
      { name: "description", content: "Entre em contato com a imoB365. Atendimento 365 dias por ano em Santos, Praia Grande e São Vicente." },
    ],
  }),
  component: ContatoPage,
});

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
    if (!aceite) { toast.error("Aceite a política de privacidade para continuar."); return; }
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
    if (error) { toast.error("Erro ao enviar. Tente novamente."); return; }
    setDone(true);
    toast.success("Mensagem enviada! Retornaremos em breve.");
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="py-14 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Info */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Fale Conosco
                </span>
                <h1 className="text-2xl font-black tracking-tight">
                  Estamos prontos para te atender
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nossa equipe especializada no mercado de alto padrão do Litoral Sul
                  retorna em até 2 horas nos dias úteis.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "(13) 99779-4382", href: "tel:+5513997794382" },
                  { icon: Mail, label: "contato@imob365.com.br", href: "mailto:contato@imob365.com.br" },
                  { icon: MapPin, label: "Praia Grande · Santos · São Vicente, SP", href: null },
                  { icon: MessageCircle, label: "WhatsApp disponível 365 dias", href: "https://wa.me/5513997794382" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <c.icon className="h-4 w-4 text-primary" />
                    </div>
                    {c.href ? (
                      <a href={c.href} className="text-sm font-medium hover:text-primary transition-colors">{c.label}</a>
                    ) : (
                      <span className="text-sm text-muted-foreground">{c.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            {done ? (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/30 p-10 text-center">
                <div className="space-y-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="font-bold">Mensagem enviada!</p>
                  <p className="text-sm text-muted-foreground">Retornaremos em breve para {email}.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ct-nome" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nome *</Label>
                    <Input id="ct-nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Seu nome" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ct-email" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">E-mail *</Label>
                    <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ct-tel" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Telefone / WhatsApp</Label>
                  <Input id="ct-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(13) 99999-9999" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ct-msg" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Mensagem *</Label>
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
                  <label htmlFor="ct-aceite" className="text-[11px] text-muted-foreground leading-relaxed">
                    Li e aceito a{" "}
                    <a href="/politica-de-privacidade" className="text-primary underline">
                      Política de Privacidade
                    </a>
                    {" "}e concordo em ser contatado pela imoB365.
                  </label>
                </div>
                <Button type="submit" disabled={loading || !aceite} className="w-full font-bold h-9">
                  {loading ? "Enviando..." : "Enviar Mensagem"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
