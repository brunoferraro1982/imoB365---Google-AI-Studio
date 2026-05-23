import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/avaliacao/$tenantSlug")({
  component: AvaliacaoPage,
  head: ({ params }) => ({
    meta: [
      { title: `Avaliação gratuita de imóvel — ${params.tenantSlug}` },
      { name: "description", content: "Receba uma avaliação profissional gratuita do seu imóvel em até 24h." },
    ],
  }),
});

function AvaliacaoPage() {
  const { tenantSlug } = Route.useParams();
  const [tenant, setTenant] = useState<{ id: string; nome: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState("apartamento");
  const [finalidade, setFinalidade] = useState("venda");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [area, setArea] = useState("");
  const [quartos, setQuartos] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tenants").select("id,nome").eq("slug", tenantSlug).maybeSingle();
      setTenant(data ?? null);
      setLoading(false);
    })();
  }, [tenantSlug]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe seu nome");
    if (!email.trim() && !telefone.trim()) return toast.error("Informe e-mail ou telefone");
    setSending(true);
    const mensagem = [
      `Solicitação de avaliação de imóvel`,
      `Tipo: ${tipo} · Finalidade: ${finalidade}`,
      cidade ? `Local: ${bairro ? bairro + ", " : ""}${cidade}` : "",
      area ? `Área: ${area} m²` : "",
      quartos ? `Quartos: ${quartos}` : "",
      observacoes ? `\n${observacoes}` : "",
    ].filter(Boolean).join("\n");

    const { data: leadId, error } = await (supabase as any).rpc("public_create_tenant_lead", {
      _tenant_slug: tenantSlug,
      _nome: nome.trim().slice(0, 200),
      _email: email.trim().slice(0, 255),
      _telefone: telefone.trim().slice(0, 40),
      _mensagem: mensagem.slice(0, 2000),
    });

    if (error) { setSending(false); return toast.error("Não foi possível enviar: " + error.message); }

    // tenta gravar preferências (pode falhar por RLS — não bloqueia)
    if (leadId && tenant) {
      await (supabase as any).from("lead_preferencias").insert({
        tenant_id: tenant.id,
        lead_id: leadId,
        tipos: [tipo],
        finalidade,
        cidades: cidade ? [cidade] : [],
        bairros: bairro ? [bairro] : [],
        quartos_min: quartos ? Number(quartos) : null,
        area_min: area ? Number(area) : null,
        observacoes: observacoes || null,
      }).then(() => {}, () => {});
    }

    setSending(false);
    setSent(true);
    toast.success("Solicitação enviada!");
  }

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!tenant) return (
    <div className="p-16 text-center">
      <h1 className="text-2xl font-bold">Imobiliária não encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-primary hover:underline">Voltar</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Avaliação gratuita do seu imóvel
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tenant.nome} retorna em até 24h com uma estimativa de mercado baseada em vendas e locações recentes.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-3 text-xl font-semibold">Solicitação recebida</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Em breve um especialista de <strong>{tenant.nome}</strong> entrará em contato com a avaliação.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} />
              </div>
              <div>
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={40} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sobre o imóvel</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="rural">Rural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Finalidade</Label>
                  <Select value={finalidade} onValueChange={setFinalidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda">Venda</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                      <SelectItem value="ambos">Venda e locação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label className="text-xs">Área útil (m²)</Label>
                  <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} min={0} />
                </div>
                <div>
                  <Label className="text-xs">Quartos</Label>
                  <Input type="number" value={quartos} onChange={(e) => setQuartos(e.target.value)} min={0} max={20} />
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} placeholder="Reformas recentes, vaga, andar, condição geral…" />
              </div>
            </div>

            <Button type="submit" disabled={sending} className="w-full" size="lg">
              {sending ? "Enviando…" : "Solicitar avaliação gratuita"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Seus dados são tratados conforme a LGPD e usados apenas para retornar a avaliação.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}