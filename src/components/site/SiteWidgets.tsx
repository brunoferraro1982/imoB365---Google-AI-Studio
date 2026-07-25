import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Newspaper, Phone, Mail, MessageCircle, Megaphone } from "lucide-react";
import { Instagram, Facebook, Youtube, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";

export type SiteWidget = {
  id: string;
  tipo:
    | "imoveis_recentes"
    | "blog_recente"
    | "contato"
    | "redes_sociais"
    | "banner_publicitario"
    | "texto_livre";
  posicao: "esquerda" | "direita";
  ordem: number;
  titulo: string | null;
  ativo: boolean;
  config: Record<string, any>;
};

export function useSiteWidgets(tenantId: string | undefined) {
  const [widgets, setWidgets] = useState<SiteWidget[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("tenant_site_widgets")
        .select("id,tipo,posicao,ordem,titulo,ativo,config")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("ordem");
      setWidgets((data as SiteWidget[]) ?? []);
    })();
  }, [tenantId]);

  return {
    esquerda: widgets.filter((w) => w.posicao === "esquerda"),
    direita: widgets.filter((w) => w.posicao === "direita"),
    hasAny: widgets.length > 0,
  };
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ImoveisRecentesWidget({ widget, tenantId }: { widget: SiteWidget; tenantId: string }) {
  const [imoveis, setImoveis] = useState<any[]>([]);
  const limite = Number(widget.config?.limite) || 4;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("id,slug,titulo,preco,endereco_bairro,endereco_cidade")
        .eq("tenant_id", tenantId)
        .eq("publicado", true)
        .eq("status", "ativo")
        .order("publicado_em", { ascending: false })
        .limit(limite);
      setImoveis(data ?? []);
    })();
  }, [tenantId, limite]);

  if (imoveis.length === 0) return null;

  return (
    <WidgetCard title={widget.titulo || "Imóveis recentes"}>
      <div className="space-y-4">
        {imoveis.map((i) => (
          <Link
            key={i.id}
            to="/imovel/$slug"
            params={{ slug: i.slug }}
            className="group flex items-start gap-2 text-sm"
          >
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="line-clamp-2 font-medium leading-snug group-hover:text-primary">
                {i.titulo}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBRL(i.preco)}
                {i.endereco_bairro ? ` · ${i.endereco_bairro}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

function BlogRecenteWidget({
  widget,
  tenantId,
  tenantSlug,
}: {
  widget: SiteWidget;
  tenantId: string;
  tenantSlug: string;
}) {
  const [posts, setPosts] = useState<any[]>([]);
  const limite = Number(widget.config?.limite) || 4;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,titulo,publicado_em")
        .eq("tenant_id", tenantId)
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(limite);
      setPosts(data ?? []);
    })();
  }, [tenantId, limite]);

  if (posts.length === 0) return null;

  return (
    <WidgetCard title={widget.titulo || "Do blog"}>
      <div className="space-y-4">
        {posts.map((p) => (
          <Link
            key={p.id}
            to="/site/$slug/blog/$postSlug"
            params={{ slug: tenantSlug, postSlug: p.slug }}
            className="group flex items-start gap-2 text-sm"
          >
            <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="line-clamp-2 font-medium leading-snug group-hover:text-primary">
              {p.titulo}
            </p>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

function ContatoWidget({ widget, ctx }: { widget: SiteWidget; ctx: SiteCtx }) {
  const waHref = ctx.settings.contato_whatsapp
    ? `https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`
    : null;
  if (!ctx.settings.contato_telefone && !ctx.settings.contato_email && !waHref) return null;

  return (
    <WidgetCard title={widget.titulo || "Fale conosco"}>
      <div className="space-y-3 text-sm">
        {ctx.settings.contato_telefone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> {ctx.settings.contato_telefone}
          </div>
        )}
        {ctx.settings.contato_email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> {ctx.settings.contato_email}
          </div>
        )}
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
          </a>
        )}
      </div>
    </WidgetCard>
  );
}

function RedesSociaisWidget({ widget, ctx }: { widget: SiteWidget; ctx: SiteCtx }) {
  const links = [
    { url: ctx.settings.instagram_url, icon: Instagram, label: "Instagram" },
    { url: ctx.settings.facebook_url, icon: Facebook, label: "Facebook" },
    { url: ctx.settings.youtube_url, icon: Youtube, label: "YouTube" },
    { url: ctx.settings.linkedin_url, icon: Linkedin, label: "LinkedIn" },
  ].filter((l) => l.url);
  if (links.length === 0) return null;

  return (
    <WidgetCard title={widget.titulo || "Siga nas redes"}>
      <div className="flex gap-3">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.url!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.label}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <l.icon className="h-4 w-4" />
          </a>
        ))}
      </div>
    </WidgetCard>
  );
}

function BannerPublicitarioWidget({ widget }: { widget: SiteWidget }) {
  const { imagem_url, link_url, texto } = widget.config || {};
  if (!imagem_url && !texto) return null;

  const content = (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      {imagem_url && (
        <img src={imagem_url} alt={texto || "Publicidade"} className="w-full object-cover" />
      )}
      {texto && (
        <div className="flex items-center gap-2 bg-primary p-3 text-sm font-semibold text-primary-foreground">
          <Megaphone className="h-4 w-4 shrink-0" />
          {texto}
        </div>
      )}
    </div>
  );

  return link_url ? (
    <a href={link_url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}

function TextoLivreWidget({ widget }: { widget: SiteWidget }) {
  const html = widget.config?.conteudo_html;
  if (!html) return null;
  return (
    <WidgetCard title={widget.titulo || "Aviso"}>
      <div
        className="prose prose-sm max-w-none [&_p]:mb-2 [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </WidgetCard>
  );
}

function SiteWidgetCard({ widget, ctx }: { widget: SiteWidget; ctx: SiteCtx }) {
  switch (widget.tipo) {
    case "imoveis_recentes":
      return <ImoveisRecentesWidget widget={widget} tenantId={ctx.tenantId} />;
    case "blog_recente":
      return (
        <BlogRecenteWidget widget={widget} tenantId={ctx.tenantId} tenantSlug={ctx.tenantSlug} />
      );
    case "contato":
      return <ContatoWidget widget={widget} ctx={ctx} />;
    case "redes_sociais":
      return <RedesSociaisWidget widget={widget} ctx={ctx} />;
    case "banner_publicitario":
      return <BannerPublicitarioWidget widget={widget} />;
    case "texto_livre":
      return <TextoLivreWidget widget={widget} />;
    default:
      return null;
  }
}

/**
 * Layout de 3 colunas ao estilo WordPress: barra lateral esquerda (opcional),
 * conteúdo central e barra lateral direita (opcional). Colunas vazias somem
 * — nunca reserva espaço em branco para uma sidebar sem widgets.
 */
export function SiteWidgetsLayout({
  ctx,
  esquerda,
  direita,
  children,
}: {
  ctx: SiteCtx;
  esquerda: SiteWidget[];
  direita: SiteWidget[];
  children: React.ReactNode;
}) {
  const hasLeft = esquerda.length > 0;
  const hasRight = direita.length > 0;

  if (!hasLeft && !hasRight) return <>{children}</>;

  // Grid de 3 colunas só a partir de xl: (antes ficava sempre reservado via
  // style inline, mesmo com os asides visualmente `hidden` entre lg/xl —
  // deixava uma faixa vazia no meio do layout nessa faixa de largura).
  // Colunas mais estreitas (240px, era 260px) e activam só em xl: (era lg:)
  // pra dar mais respiro real ao conteúdo principal — a mesma seção de
  // imóveis em destaque não deve ficar espremida numa coluna estreita.
  const gridColsClass =
    hasLeft && hasRight
      ? "grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_240px]"
      : hasLeft
        ? "grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)]"
        : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px]";

  return (
    <div className={`mx-auto grid max-w-6xl gap-10 px-6 ${gridColsClass}`}>
      {hasLeft && (
        <aside className="hidden space-y-6 xl:block">
          {esquerda.map((w) => (
            <SiteWidgetCard key={w.id} widget={w} ctx={ctx} />
          ))}
        </aside>
      )}
      <div className="min-w-0">{children}</div>
      {hasRight && (
        <aside className="hidden space-y-6 xl:block">
          {direita.map((w) => (
            <SiteWidgetCard key={w.id} widget={w} ctx={ctx} />
          ))}
        </aside>
      )}
    </div>
  );
}

/**
 * Wrapper de conveniência: header/rodapé do TenantSiteLayout + o
 * conteúdo central envolvido no layout de 3 colunas com os widgets
 * ativos do tenant. Usado nas páginas de conteúdo (blog, posts,
 * páginas customizadas) — a home tem seções full-width próprias e
 * monta o layout de widgets manualmente ao redor da seção de imóveis.
 */
export function TenantSiteLayoutWithWidgets({
  ctx,
  children,
}: {
  ctx: SiteCtx;
  children: React.ReactNode;
}) {
  const { esquerda, direita } = useSiteWidgets(ctx.tenantId);
  return (
    <TenantSiteLayout ctx={ctx}>
      <section className="py-16">
        <SiteWidgetsLayout ctx={ctx} esquerda={esquerda} direita={direita}>
          {children}
        </SiteWidgetsLayout>
      </section>
    </TenantSiteLayout>
  );
}
