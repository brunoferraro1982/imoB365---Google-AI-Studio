import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

// Precisa espelhar exatamente o enum `parte_papel` do banco (ver
// supabase/migrations/20260521144213_..sql:42 +
// 20260728150000_contratos_clm_sprint2_participantes.sql) — um valor aqui
// que não existe no enum faz o INSERT falhar em runtime.
const PAPEIS = [
  { value: "vendedor", label: "Vendedor" },
  { value: "comprador", label: "Comprador" },
  { value: "locador", label: "Locador" },
  { value: "locatario", label: "Locatário" },
  { value: "fiador", label: "Fiador" },
  { value: "procurador", label: "Procurador" },
  { value: "testemunha", label: "Testemunha" },
  { value: "corretor", label: "Corretor" },
  { value: "advogado", label: "Advogado" },
  { value: "administrador", label: "Administrador" },
  { value: "outro", label: "Outro" },
] as const;

const ASSINATURA_PARTE_LABEL: Record<string, string> = {
  pendente: "Assinatura pendente",
  enviado: "Assinatura enviada",
  assinado: "Assinado",
};

type Parte = {
  id: string;
  papel: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  percentual_participacao: number | null;
  responsabilidade: string | null;
  assinatura_status: string;
  nacionalidade: string | null;
  estado_civil: string | null;
  profissao: string | null;
  endereco: string | null;
};

const FORM_INICIAL = {
  papel: "comprador",
  nome: "",
  documento: "",
  email: "",
  telefone: "",
  percentualParticipacao: "",
  responsabilidade: "",
  nacionalidade: "",
  estadoCivil: "",
  profissao: "",
  endereco: "",
};

export function PartesSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [partes, setPartes] = useState<Parte[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORM_INICIAL);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_partes")
      .select(
        "id,papel,nome,documento,email,telefone,percentual_participacao,responsabilidade,assinatura_status,nacionalidade,estado_civil,profissao,endereco",
      )
      .eq("contrato_id", contratoId)
      .order("created_at");
    if (error) toast.error(error.message);
    setPartes((data ?? []) as Parte[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [contratoId]);

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
      percentual_participacao: form.percentualParticipacao
        ? Number(form.percentualParticipacao)
        : null,
      responsabilidade: form.responsabilidade.trim() || null,
      nacionalidade: form.nacionalidade.trim() || null,
      estado_civil: form.estadoCivil.trim() || null,
      profissao: form.profissao.trim() || null,
      endereco: form.endereco.trim() || null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parte adicionada");
    setForm(FORM_INICIAL);
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
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {p.papel}
                  </Badge>
                  <span className="font-medium">{p.nome}</span>
                  {p.percentual_participacao != null && (
                    <span className="text-xs text-muted-foreground">
                      {p.percentual_participacao}% de participação
                    </span>
                  )}
                  <Badge
                    variant={p.assinatura_status === "assinado" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {ASSINATURA_PARTE_LABEL[p.assinatura_status] ?? p.assinatura_status}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {[p.documento, p.email, p.telefone].filter(Boolean).join(" · ") || "—"}
                </div>
                {(p.responsabilidade || p.profissao || p.nacionalidade || p.estado_civil) && (
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {[p.responsabilidade, p.profissao, p.nacionalidade, p.estado_civil]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addParte} className="space-y-3 border-t border-border pt-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-1">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Papel</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.papel}
              onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
            >
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              maxLength={200}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">CPF/CNPJ</Label>
            <Input
              value={form.documento}
              onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
              maxLength={40}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              maxLength={255}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Telefone
              </Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                maxLength={40}
              />
            </div>
            <Button type="submit" size="icon" disabled={saving} aria-label="Adicionar">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMostrarDetalhes((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {mostrarDetalhes ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Qualificação e participação (opcional)
        </button>

        {mostrarDetalhes && (
          <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-6">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Participação (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.percentualParticipacao}
                onChange={(e) => setForm((f) => ({ ...f, percentualParticipacao: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Responsabilidade
              </Label>
              <Input
                value={form.responsabilidade}
                onChange={(e) => setForm((f) => ({ ...f, responsabilidade: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Nacionalidade
              </Label>
              <Input
                value={form.nacionalidade}
                onChange={(e) => setForm((f) => ({ ...f, nacionalidade: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Estado civil
              </Label>
              <Input
                value={form.estadoCivil}
                onChange={(e) => setForm((f) => ({ ...f, estadoCivil: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Profissão
              </Label>
              <Input
                value={form.profissao}
                onChange={(e) => setForm((f) => ({ ...f, profissao: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Endereço
              </Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                maxLength={300}
              />
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
