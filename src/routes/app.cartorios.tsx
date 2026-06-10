import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/cartorios")({
  head: () => ({ meta: [{ title: "Cartórios — imob365" }] }),
  component: CartoriosPage,
});

const TIPO_LABEL: Record<string, string> = {
  escritura: "Escritura",
  registro: "Registro",
  averbacao: "Averbação",
  procuracao: "Procuração",
  outro: "Outro",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  protocolado: "Protocolado",
  em_exigencia: "Em exigência",
  registrado: "Registrado",
  cancelado: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "secondary",
  protocolado: "default",
  em_exigencia: "destructive",
  registrado: "default",
  cancelado: "outline",
};

function CartoriosPage() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({
    tipo: "escritura",
    contrato_id: "",
    protocolo: "",
    cartorio_nome: "",
    cidade: "",
    uf: "",
    status: "pendente",
    data_protocolo: "",
    custas: "",
    observacoes: "",
  });

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase
        .from("cartorio_registros")
        .select("*,contrato:contratos(id,numero)")
        .order("created_at", { ascending: false }),
      supabase.from("contratos").select("id,numero").order("numero"),
    ]);
    setItems(r ?? []);
    setContratos(c ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function add() {
    if (!tenantId) return;
    const { error } = await supabase.from("cartorio_registros").insert({
      tenant_id: tenantId,
      tipo: form.tipo,
      contrato_id: form.contrato_id || null,
      protocolo: form.protocolo || null,
      cartorio_nome: form.cartorio_nome || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      status: form.status,
      data_protocolo: form.data_protocolo || null,
      custas: form.custas ? Number(form.custas) : null,
      observacoes: form.observacoes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Registro criado");
    setShowForm(false);
    setForm({
      tipo: "escritura",
      contrato_id: "",
      protocolo: "",
      cartorio_nome: "",
      cidade: "",
      uf: "",
      status: "pendente",
      data_protocolo: "",
      custas: "",
      observacoes: "",
    });
    load();
  }

  async function setStatus(id: string, status: string) {
    await supabase
      .from("cartorio_registros")
      .update({ status: status as any })
      .eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Excluir registro?")) return;
    await supabase.from("cartorio_registros").delete().eq("id", id);
    load();
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cartórios</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de escrituras, registros e averbações.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-2 h-4 w-4" /> Novo registro
        </Button>
      </header>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato</Label>
              <Select
                value={form.contrato_id}
                onValueChange={(v) => setForm({ ...form, contrato_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cartório</Label>
              <Input
                value={form.cartorio_nome}
                onChange={(e) => setForm({ ...form, cartorio_nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label>Protocolo</Label>
              <Input
                value={form.protocolo}
                onChange={(e) => setForm({ ...form, protocolo: e.target.value })}
              />
            </div>
            <div>
              <Label>Data protocolo</Label>
              <Input
                type="date"
                value={form.data_protocolo}
                onChange={(e) => setForm({ ...form, data_protocolo: e.target.value })}
              />
            </div>
            <div>
              <Label>Custas (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custas}
                onChange={(e) => setForm({ ...form, custas: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={add}>Salvar</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
        Integrações automáticas com e-Notariado e ONR estarão disponíveis em breve. Por enquanto,
        registre manualmente o andamento.
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-12 text-center">
          <Landmark className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum registro cadastrado.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {items.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{TIPO_LABEL[r.tipo] ?? r.tipo}</span>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  {r.contrato?.numero && (
                    <Badge variant="outline">Contrato #{r.contrato.numero}</Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.cartorio_nome ?? "—"} · {r.cidade ?? ""}/{r.uf ?? ""}
                  {r.protocolo && ` · Protocolo ${r.protocolo}`}
                  {r.data_protocolo &&
                    ` · ${new Date(r.data_protocolo).toLocaleDateString("pt-BR")}`}
                  {r.custas &&
                    ` · R$ ${Number(r.custas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </div>
                {r.observacoes && (
                  <div className="mt-1 text-xs text-muted-foreground">{r.observacoes}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Select value={r.status} onValueChange={(s) => setStatus(r.id, s)}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
