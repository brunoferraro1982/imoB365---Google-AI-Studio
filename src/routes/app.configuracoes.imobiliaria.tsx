import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/imobiliaria")({
  component: ConfigImobiliaria,
});

function ConfigImobiliaria() {
  const { tenantId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data: t } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    setData(t);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  function update(k: string, v: any) {
    setData((d: any) => ({ ...d, [k]: v }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        nome: data.nome,
        slug: data.slug,
        cnpj: data.cnpj,
        creci_juridico: data.creci_juridico,
        dominio_proprio: data.dominio_proprio,
      })
      .eq("id", tenantId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
  }

  if (loading || !data) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Identidade</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome fantasia *">
            <Input
              required
              value={data.nome ?? ""}
              onChange={(e) => update("nome", e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Slug (URL pública)">
            <Input
              value={data.slug ?? ""}
              onChange={(e) => update("slug", e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={data.cnpj ?? ""}
              onChange={(e) => update("cnpj", e.target.value)}
              maxLength={20}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="CRECI Jurídico (CRECI-J)">
            <Input
              value={data.creci_juridico ?? ""}
              onChange={(e) => update("creci_juridico", e.target.value)}
              maxLength={40}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Domínio</h2>
        <Field label="Domínio próprio">
          <Input
            value={data.dominio_proprio ?? ""}
            onChange={(e) => update("dominio_proprio", e.target.value)}
            placeholder="ex.: site.minhaimobiliaria.com.br"
            maxLength={255}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A verificação por DNS TXT será habilitada na fase de white-label.
          </p>
        </Field>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div>
          <div>
            Plano atual:{" "}
            <span className="font-medium text-foreground">{data.plano_slug ?? "—"}</span>
          </div>
          <div>
            Status: <span className="font-medium text-foreground">{data.status}</span>
          </div>
        </div>
        <span>Para mudar plano ou status, fale com o super-admin.</span>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
