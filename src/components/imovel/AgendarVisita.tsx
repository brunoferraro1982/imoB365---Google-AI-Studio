import { useState, type FormEvent } from "react";
import { CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function defaultDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AgendarVisita({ imovelId, titulo }: { imovelId: string; titulo: string }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataHora, setDataHora] = useState(defaultDate());
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe seu nome");
    if (!email.trim() && !telefone.trim()) return toast.error("Informe e-mail ou telefone");
    if (email.trim() && !EMAIL_RE.test(email.trim())) return toast.error("E-mail inválido");
    setSending(true);
    const { error } = await (supabase as any).rpc("public_solicitar_visita", {
      _imovel_id: imovelId,
      _data_hora: new Date(dataHora).toISOString(),
      _nome: nome.trim().slice(0, 200),
      _email: email.trim().slice(0, 255),
      _telefone: telefone.trim().slice(0, 40),
      _mensagem: mensagem.trim().slice(0, 2000),
    });
    setSending(false);
    if (error) return toast.error("Não foi possível agendar: " + error.message);
    setSent(true);
    toast.success("Visita solicitada! O corretor confirmará em breve.");
  }

  if (sent) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
        Sua visita foi solicitada. Você receberá uma confirmação por e-mail.
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>
        <CalendarCheck className="mr-2 h-4 w-4" /> Agendar uma visita
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <h3 className="text-sm font-semibold">Agendar visita</h3>
      <div>
        <Label className="text-xs">Data e horário *</Label>
        <Input
          type="datetime-local"
          value={dataHora}
          min={new Date().toISOString().slice(0, 16)}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
      </div>
      <div>
        <Label className="text-xs">Seu nome *</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} />
      </div>
      <div>
        <Label className="text-xs">E-mail</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
        />
      </div>
      <div>
        <Label className="text-xs">Telefone / WhatsApp</Label>
        <Input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          maxLength={40}
          placeholder="(11) 99999-9999"
        />
      </div>
      <div>
        <Label className="text-xs">Observação</Label>
        <Textarea
          rows={2}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={2000}
          placeholder={`Tenho interesse em visitar "${titulo}"`}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={sending} className="flex-1">
          {sending ? "Enviando…" : "Solicitar visita"}
        </Button>
      </div>
    </form>
  );
}
