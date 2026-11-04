import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EditorPerfilCorretor } from "@/components/corretores/EditorPerfilCorretor";

// Super admin edita o perfil público de qualquer corretor (RLS
// corretores_super_admin_all + storage "corretor-fotos super_admin *").
export const Route = createFileRoute("/admin/corretores/$id")({
  component: AdminEditarCorretor,
});

function AdminEditarCorretor() {
  const { id } = Route.useParams();
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("corretores")
      .select("tenant_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setTenantId(data?.tenant_id ?? null));
  }, [id]);

  return (
    <EditorPerfilCorretor
      id={id}
      voltar={
        <Button variant="ghost" size="sm" asChild>
          {tenantId ? (
            <Link to="/admin/tenants/$id" params={{ id: tenantId }}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Perfil da imobiliária
            </Link>
          ) : (
            <Link to="/admin/tenants">
              <ChevronLeft className="mr-1 h-4 w-4" /> Imobiliárias & Usuários
            </Link>
          )}
        </Button>
      }
    />
  );
}
