import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { LayoutKey } from "@/lib/siteSections";
import { SecaoTitulo } from "./ui";

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
  compact,
}: {
  variant: LayoutKey;
  tenantId: string;
  tenantSlug: string;
  /** Renderização em 1 coluna, para quando o bloco está numa área lateral (layout 'amplo'). */
  compact?: boolean;
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

  const cols = compact ? "" : variant === "boutique" ? "@md:grid-cols-2" : "@md:grid-cols-3";
  const shownPosts = compact ? posts.slice(0, 3) : posts;

  return (
    <div className="@container">
      <SecaoTitulo compact={compact} eyebrow="Conteúdo" titulo="Blog em destaque" />
      <div className={`grid gap-6 ${cols}`}>
        {shownPosts.map((p) => (
          <Link
            key={p.id}
            to="/site/$slug/blog/$postSlug"
            params={{ slug: tenantSlug, postSlug: p.slug }}
            className="glass-fosco group overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1"
          >
            {p.imagem_url && !compact && (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={p.imagem_url}
                  alt={p.titulo}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-5">
              <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">
                {p.titulo}
              </h3>
              {p.resumo && !compact && (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.resumo}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
