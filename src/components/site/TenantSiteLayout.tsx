import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Youtube, Linkedin, Phone, Mail, MapPin } from "lucide-react";

export type SiteCtx = {
  tenantSlug: string;
  tenantNome: string;
  settings: {
    contato_telefone?: string | null;
    contato_whatsapp?: string | null;
    contato_email?: string | null;
    endereco?: string | null;
    instagram_url?: string | null;
    facebook_url?: string | null;
    youtube_url?: string | null;
    linkedin_url?: string | null;
    cor_destaque?: string | null;
  };
  pages: { slug: string; titulo: string }[];
};

export function TenantSiteLayout({ ctx, children }: { ctx: SiteCtx; children: React.ReactNode }) {
  const cor = ctx.settings.cor_destaque || undefined;
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={cor ? { ["--site-accent" as any]: cor } : undefined}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/site/$slug"
            params={{ slug: ctx.tenantSlug }}
            className="text-lg font-semibold tracking-tight"
          >
            {ctx.tenantNome}
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link
              to="/site/$slug"
              params={{ slug: ctx.tenantSlug }}
              className="text-muted-foreground hover:text-foreground"
            >
              Início
            </Link>
            {ctx.pages.map((p) => (
              <Link
                key={p.slug}
                to="/site/$slug/p/$pageSlug"
                params={{ slug: ctx.tenantSlug, pageSlug: p.slug }}
                className="text-muted-foreground hover:text-foreground"
              >
                {p.titulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-semibold">{ctx.tenantNome}</h3>
            {ctx.settings.endereco && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.settings.endereco}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Contato</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {ctx.settings.contato_telefone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {ctx.settings.contato_telefone}
                </li>
              )}
              {ctx.settings.contato_email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> {ctx.settings.contato_email}
                </li>
              )}
              {ctx.settings.contato_whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Redes sociais</h3>
            <div className="flex gap-3">
              {ctx.settings.instagram_url && (
                <a
                  href={ctx.settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </a>
              )}
              {ctx.settings.facebook_url && (
                <a
                  href={ctx.settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </a>
              )}
              {ctx.settings.youtube_url && (
                <a
                  href={ctx.settings.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </a>
              )}
              {ctx.settings.linkedin_url && (
                <a
                  href={ctx.settings.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {ctx.tenantNome}
        </div>
      </footer>
    </div>
  );
}
