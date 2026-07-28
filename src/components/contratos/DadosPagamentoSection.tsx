import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

// Dados bancários/PIX pro repasse ao proprietário — hoje locacao_repasses
// registra que foi repassado, mas não tinha pra onde mandar o valor.
const TIPOS_CHAVE_PIX = [
  { value: "cpf_cnpj", label: "CPF/CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export function DadosPagamentoSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipoChavePix: "cpf_cnpj",
    chavePix: "",
    banco: "",
    agencia: "",
    conta: "",
  });

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contrato_dados_pagamento")
      .select("id,tipo_chave_pix,chave_pix,banco,agencia,conta")
      .eq("contrato_id", contratoId)
      .maybeSingle();
    if (data) {
      setId(data.id);
      setForm({
        tipoChavePix: data.tipo_chave_pix ?? "cpf_cnpj",
        chavePix: data.chave_pix ?? "",
        banco: data.banco ?? "",
        agencia: data.agencia ?? "",
        conta: data.conta ?? "",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contratoId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      contrato_id: contratoId,
      tipo_chave_pix: form.tipoChavePix,
      chave_pix: form.chavePix || null,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
    };
    const { error } = id
      ? await (supabase as any).from("contrato_dados_pagamento").update(payload).eq("id", id)
      : await (supabase as any).from("contrato_dados_pagamento").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados de pagamento salvos");
    load();
  }

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
        <Landmark className="h-4 w-4" /> Dados bancários do proprietário
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Destino do repasse de aluguel — visível apenas para admin/financeiro.
      </p>
      <form onSubmit={salvar} className="grid gap-4 md:grid-cols-5">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Tipo de chave PIX
          </Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.tipoChavePix}
            onChange={(e) => setForm((f) => ({ ...f, tipoChavePix: e.target.value }))}
          >
            {TIPOS_CHAVE_PIX.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Chave PIX</Label>
          <Input
            value={form.chavePix}
            onChange={(e) => setForm((f) => ({ ...f, chavePix: e.target.value }))}
            maxLength={140}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Banco</Label>
          <Input
            value={form.banco}
            onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
            maxLength={100}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Agência</Label>
          <Input
            value={form.agencia}
            onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))}
            maxLength={20}
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Conta</Label>
            <Input
              value={form.conta}
              onChange={(e) => setForm((f) => ({ ...f, conta: e.target.value }))}
              maxLength={30}
            />
          </div>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <Button type="submit" disabled={saving}>
            {id ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </form>
    </section>
  );
}
