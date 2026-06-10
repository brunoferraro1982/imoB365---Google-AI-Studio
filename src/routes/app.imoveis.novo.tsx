import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/ImovelForm";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/imoveis/novo")({
  component: NovoImovel,
});

function NovoImovel() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function save(data: ImovelFormData, action: "save" | "publish" | "unpublish" = "save") {
    if (!tenantId || !user) {
      toast.error("Sua conta ainda não está vinculada a uma imobiliária.");
      return;
    }
    setSaving(true);
    const slug = data.slug || slugify(data.titulo);
    const { data: inserted, error } = await supabase
      .from("imoveis")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        ...data,
        finalidade: data.finalidade as "venda" | "aluguel" | "temporada",
        tipo: data.tipo as never,
        status: data.status as never,
        slug,
        publicado_em: data.publicado ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(action === "publish" ? "Imóvel publicado no site" : "Rascunho salvo");
    navigate({ to: "/app/imoveis/$id", params: { id: inserted!.id } });
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/app/imoveis">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Novo imóvel</h1>
      <ImovelForm onSubmit={save} submitLabel="Criar imóvel" submitting={saving} mode="create" />
    </div>
  );
}
