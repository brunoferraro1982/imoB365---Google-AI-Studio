import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { BlogManager } from "@/components/blog/BlogManager";

export const Route = createFileRoute("/app/site/blog")({
  component: BlogManagerPage,
});

function BlogManagerPage() {
  const { tenantId, loading } = useAuth();

  if (loading) return null;

  return (
    <BlogManager
      tenantId={tenantId}
      title="Blog & Artigos"
      subtitle="Crie artigos para o blog do seu site — visíveis apenas para os visitantes da sua imobiliária."
    />
  );
}
