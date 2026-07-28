import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Headset, Search } from "lucide-react";
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
        content: "Abra ou acompanhe um chamado de atendimento com a imoB365.",
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
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Número do chamado (CH-000123)"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="flex-1"
        />
        <Input
          type="email"
          placeholder="E-mail usado na abertura"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button onClick={buscar} disabled={buscando}>
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
                className={`rounded-md p-3 text-sm ${m.autor_tipo === "agente" ? "bg-primary/10" : "bg-muted"}`}
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

function AtendimentoPage() {
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-background px-4 py-16">
          <div className="container mx-auto max-w-3xl space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              <Headset className="h-3.5 w-3.5" /> Central de Atendimento
            </span>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Como podemos ajudar?
            </h1>
            <p className="mx-auto max-w-xl text-sm text-white/65">
              Abra um chamado novo ou acompanhe um chamado já existente pelo número e o e-mail
              usados na abertura.
            </p>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="container mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-lg font-black tracking-tight">Abrir novo chamado</h2>
              <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
                <AtendimentoWidget />
              </div>
            </div>
            <div>
              <h2 className="mb-4 text-lg font-black tracking-tight">Acompanhar chamado</h2>
              <AcompanharChamado />
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
