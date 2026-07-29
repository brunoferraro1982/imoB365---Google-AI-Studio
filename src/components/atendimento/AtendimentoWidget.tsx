import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

// Mesmo padrão de validação já usado em AgendarVisita.tsx (EMAIL_RE) —
// telefone aqui usa contagem de dígitos (10 ou 11, DDD+fixo/celular) em vez
// de regex de formatação, tolerando qualquer jeito de digitar.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function telefoneValido(v: string) {
  const digitos = v.replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11;
}

// Widget compartilhado de "abrir chamado" — usado dentro do AtendimentoFAB
// (painel flutuante) e da página pública /atendimento (seção "Novo
// chamado"). Reaproveita a mesma RPC pública public_create_chamado
// (SECURITY DEFINER), que decide sozinha o balcão/tenant certo a partir do
// contexto opcional (imóvel/corretor) — este componente só coleta os dados.
export function AtendimentoWidget({
  imovelId,
  corretorSlug,
  compact = false,
}: {
  imovelId?: string;
  corretorSlug?: string;
  compact?: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);

  async function enviar() {
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome.");
      return;
    }
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      toast.error("Informe um e-mail válido — é por ele que você acompanha o chamado depois.");
      return;
    }
    if (telefone.trim() && !telefoneValido(telefone.trim())) {
      toast.error("Telefone inválido — informe DDD + número.");
      return;
    }
    if (mensagem.trim().length < 5) {
      toast.error("Escreva sua mensagem.");
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("public_create_chamado", {
        _nome: nome.trim(),
        _email: email.trim(),
        _telefone: telefone.trim(),
        _mensagem: mensagem.trim(),
        _categoria: "outro",
        _imovel_id: imovelId,
        _corretor_slug: corretorSlug,
      });
      if (error) throw error;
      const resultado = data as { numero?: string } | null;
      setNumero(resultado?.numero ?? null);
      toast.success("Chamado registrado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar chamado");
    } finally {
      setEnviando(false);
    }
  }

  if (numero) {
    return (
      <div
        className={
          compact
            ? "p-4 text-center text-sm"
            : "rounded-xl border border-border bg-card p-6 text-center"
        }
      >
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <p className="font-semibold">Chamado {numero} registrado!</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Guarde esse número — você pode acompanhar a resposta em /atendimento com ele e o seu
          e-mail.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2 p-4" : "space-y-3"}>
      <Input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input
        type="email"
        placeholder="Seu e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        placeholder="Telefone / WhatsApp (opcional)"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
      />
      <Textarea
        placeholder="Como podemos ajudar?"
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={compact ? 3 : 4}
      />
      <Button onClick={enviar} disabled={enviando} className="w-full">
        {enviando ? "Enviando..." : "Abrir chamado"}
      </Button>
    </div>
  );
}
