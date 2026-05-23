import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const PAPEIS = [
  { value: "vendedor", label: "Vendedor" },
  { value: "comprador", label: "Comprador" },
  { value: "locador", label: "Locador" },
  { value: "locatario", label: "Locatário" },
  { value: "fiador", label: "Fiador" },
  { value: "testemunha", label: "Testemunha" },
  { value: "corretor", label: "Corretor" },
  { value: "outro", label: "Outro" },
] as const;

type Parte = {
  id: string;
  papel: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
};

export function PartesSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [partes, setPartes] = useState<Parte[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ papel: "comprador", nome: "", documento: "", email: "", telefone: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_partes")
      .select("id,papel,nome,documento,email,telefone")
      .eq("contrato_id", contratoId)
      .order("created_at");
    if (error) toast.error(error.message);
    setPartes((data ?? []) as Parte[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [contratoId]);

  async function addParte(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    if (form.nome.trim().length < 2) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = await supabase.from("contrato_partes").insert({
      contrato_id: contratoId,
      tenant_id: tenantId,
      papel: form.papel as any,
      nome: form.nome.trim(),
      documento: form.documento.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parte adicionada");
    setForm({ papel: "comprador", nome: "", documento: "", email: "", telefone: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover esta parte?")) return;
    const { error } = await supabase.from("contrato_partes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold">Partes do contrato</h2>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : partes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma parte cadastrada ainda.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {partes.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{p.papel}</Badge>
                  <span className="font-medium">{p.nome}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {[p.documento, p.email, p.telefone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addParte} className="grid gap-3 border-t border-border pt-4 md:grid-cols-6">
        <div className="md:col-span-1">
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Papel</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.papel}
            onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
          >
            {PAPEIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
          <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} maxLength={200} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">CPF/CNPJ</Label>
          <Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} maxLength={40} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} maxLength={255} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} maxLength={40} />
          </div>
          <Button type="submit" size="icon" disabled={saving} aria-label="Adicionar">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}