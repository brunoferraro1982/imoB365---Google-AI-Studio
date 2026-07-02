import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BlogManager } from "@/components/blog/BlogManager";
import { getCorporateTenantId } from "@/lib/corporateTenant";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlogPage,
});

function AdminBlogPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCorporateTenantId().then((id) => {
      setTenantId(id);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!tenantId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Tenant institucional (slug "imob365") não encontrado.
      </div>
    );
  }

  return (
    <BlogManager
      tenantId={tenantId}
      title="Blog Institucional (Portal imoB365)"
      subtitle="Artigos do blog público em imob365.com.br/blog — visíveis a todos os visitantes do portal, independente da imobiliária."
    />
  );
}
