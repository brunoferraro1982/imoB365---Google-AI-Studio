import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LayoutKey } from "@/lib/siteSections";

type Post = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  imagem_url: string | null;
};

export function BlogDestaqueSection({
  variant,
  tenantId,
  tenantSlug,
}: {
  variant: LayoutKey;
  tenantId: string;
  tenantSlug: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,titulo,resumo,imagem_url")
        .eq("tenant_id", tenantId)
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(3);
      if (!cancelled) setPosts((data as Post[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (posts.length === 0) return null;

  const cols = variant === "boutique" ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div>
      <div className="mb-8 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Blog em destaque</h2>
      </div>
      <div className={`grid gap-6 ${cols}`}>
        {posts.map((p) => (
          <Link
            key={p.id}
            to="/site/$slug/blog/$postSlug"
            params={{ slug: tenantSlug, postSlug: p.slug }}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-md"
          >
            {p.imagem_url && (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={p.imagem_url}
                  alt={p.titulo}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="line-clamp-2 font-semibold group-hover:text-primary transition-colors">
                {p.titulo}
              </h3>
              {p.resumo && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.resumo}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
