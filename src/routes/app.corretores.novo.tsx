import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CorretorForm, type CorretorFormData } from "@/components/corretores/CorretorForm";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/corretores/novo")({
  component: NovoCorretor,
});

function NovoCorretor() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function save(data: CorretorFormData) {
    if (!tenantId) {
      toast.error("Sua conta ainda não está vinculada a uma imobiliária.");
      return;
    }
    setSaving(true);
    const slug = data.slug || slugify(data.nome);
    const { data: inserted, error } = await (supabase as any)
      .from("corretores")
      .insert({ ...data, tenant_id: tenantId, slug })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Corretor cadastrado");
    navigate({ to: "/app/corretores/$id", params: { id: inserted!.id } });
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/app/corretores">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Novo corretor</h1>
      <CorretorForm onSubmit={save} submitLabel="Cadastrar corretor" submitting={saving} />
    </div>
  );
}
