import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/quero-anunciar/$tenantSlug")({
  component: QueroAnunciarPage,
});

function QueroAnunciarPage() {
  const { tenantSlug } = Route.useParams();
  const [tenant, setTenant] = useState<any>(null);
  const [form, setForm] = useState({
    finalidade: "venda" as "venda" | "locacao",
    tipo: "apartamento",
    cidade: "",
    bairro: "",
    quartos: 2,
    area: 70,
    preco_desejado: 0,
    nome: "",
    telefone: "",
    email: "",
    observacoes: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, nome, slug")
      .eq("slug", tenantSlug)
      .maybeSingle()
      .then(({ data }) => setTenant(data));
  }, [tenantSlug]);

  async function enviar() {
    if (!tenant) return;
    setEnviando(true);
    const mensagem = `[CAPTAÇÃO] Quero ${form.finalidade === "venda" ? "vender" : "alugar"} meu ${form.tipo} de ${form.area}m² (${form.quartos}q) em ${form.bairro}, ${form.cidade}. Valor pretendido: R$ ${form.preco_desejado}. Obs: ${form.observacoes}`;
    const { error } = await (supabase as any).rpc("public_create_tenant_lead", {
      _tenant_slug: tenantSlug,
      _nome: form.nome,
      _email: form.email || null,
      _telefone: form.telefone,
      _mensagem: mensagem,
    });
    setEnviando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOk(true);
  }

  if (!tenant)
    return <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>;

  if (ok)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Recebemos seu imóvel!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A equipe da {tenant.nome} entrará em contato em breve para avaliar e iniciar a captação.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Quero anunciar meu imóvel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A {tenant.nome} cuida da divulgação, visitas e negociação. Preencha abaixo.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>O que você quer fazer?</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.finalidade}
              onChange={(e) => setForm({ ...form, finalidade: e.target.value as any })}
            >
              <option value="venda">Vender</option>
              <option value="locacao">Alugar</option>
            </select>
          </div>
          <div>
            <Label>Tipo de imóvel</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="apartamento">Apartamento</option>
              <option value="casa">Casa</option>
              <option value="terreno">Terreno</option>
              <option value="comercial">Comercial</option>
              <option value="rural">Rural</option>
            </select>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
            />
          </div>
          <div>
            <Label>Quartos</Label>
            <Input
              type="number"
              value={form.quartos}
              onChange={(e) => setForm({ ...form, quartos: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Área (m²)</Label>
            <Input
              type="number"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: Number(e.target.value) })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Valor pretendido (R$)</Label>
            <Input
              type="number"
              value={form.preco_desejado}
              onChange={(e) => setForm({ ...form, preco_desejado: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <div className="mb-3 text-sm font-semibold">Seus dados</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </div>
        <Button
          className="w-full"
          onClick={enviar}
          disabled={enviando || !form.nome || !form.telefone}
        >
          <Send className="mr-2 h-4 w-4" />
          {enviando ? "Enviando…" : "Enviar imóvel para avaliação"}
        </Button>
      </div>
    </div>
  );
}
