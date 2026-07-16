import {
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MegaNavHeader, type MegaNavConfig } from "@/components/site/MegaNav";

export type SiteCtx = {
  tenantId: string;
  tenantSlug: string;
  tenantNome: string;
  logoUrl?: string | null;
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
  hasBlog?: boolean;
  hasSobre?: boolean;
};

function buildTenantNavConfig(ctx: SiteCtx): MegaNavConfig {
  const waHref = ctx.settings.contato_whatsapp
    ? `https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`
    : null;
  return {
    logo: ctx.logoUrl ? (
      <img src={ctx.logoUrl} alt={ctx.tenantNome} className="h-9 max-w-[170px] object-contain" />
    ) : (
      <span className="text-lg font-bold tracking-tight">{ctx.tenantNome}</span>
    ),
    logoTo: `/site/${ctx.tenantSlug}`,
    groups: [
      { key: "inicio", label: "Início", to: `/site/${ctx.tenantSlug}` },
      { key: "imoveis", label: "Imóveis", to: `/site/${ctx.tenantSlug}`, hash: "imoveis" },
      ...(ctx.hasSobre
        ? [{ key: "sobre", label: "Sobre", to: `/site/${ctx.tenantSlug}`, hash: "sobre" }]
        : []),
      ...ctx.pages.map((p) => ({
        key: `page-${p.slug}`,
        label: p.titulo,
        to: `/site/${ctx.tenantSlug}/p/${p.slug}`,
      })),
      ...(ctx.hasBlog ? [{ key: "blog", label: "Blog", to: `/site/${ctx.tenantSlug}/blog` }] : []),
      { key: "contato", label: "Contato", to: `/site/${ctx.tenantSlug}`, hash: "contato" },
    ],
    extraCtas: () =>
      waHref ? (
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
          <Button
            size="sm"
            className="gap-1.5 rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Fale conosco
          </Button>
        </a>
      ) : null,
  };
}

export function TenantSiteLayout({ ctx, children }: { ctx: SiteCtx; children: React.ReactNode }) {
  const cor = ctx.settings.cor_destaque || undefined;
  const waHref = ctx.settings.contato_whatsapp
    ? `https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={cor ? ({ "--site-accent": cor, "--primary": cor } as React.CSSProperties) : undefined}
    >
      <MegaNavHeader config={buildTenantNavConfig(ctx)} />

      <main>{children}</main>

      <footer className="mt-20 border-t border-border bg-zinc-950 text-zinc-300">
        <div className="h-1 w-full bg-primary" />

        {waHref && (
          <div className="border-b border-white/10">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
              <div>
                <p className="text-lg font-bold text-white">Encontrou o imóvel ideal?</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Fale agora com {ctx.tenantNome} pelo WhatsApp.
                </p>
              </div>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <Button className="gap-2 rounded-full bg-primary px-6 text-primary-foreground hover:opacity-90">
                  <MessageCircle className="h-4 w-4" />
                  Iniciar conversa
                </Button>
              </a>
            </div>
          </div>
        )}

        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-white">
              {ctx.logoUrl ? (
                <img
                  src={ctx.logoUrl}
                  alt={ctx.tenantNome}
                  className="h-8 max-w-[150px] object-contain"
                />
              ) : (
                ctx.tenantNome
              )}
            </div>
            {ctx.settings.endereco && (
              <p className="mt-4 flex items-start gap-2 text-sm text-zinc-400">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {ctx.settings.endereco}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Contato
            </h3>
            <ul className="space-y-3 text-sm">
              {ctx.settings.contato_telefone && (
                <li className="flex items-center gap-2 text-zinc-300">
                  <Phone className="h-4 w-4 text-primary" /> {ctx.settings.contato_telefone}
                </li>
              )}
              {ctx.settings.contato_email && (
                <li className="flex items-center gap-2 text-zinc-300">
                  <Mail className="h-4 w-4 text-primary" /> {ctx.settings.contato_email}
                </li>
              )}
              {waHref && (
                <li>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-zinc-300 hover:text-white"
                  >
                    <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Redes sociais
            </h3>
            <div className="flex gap-3">
              {ctx.settings.instagram_url && (
                <a
                  href={ctx.settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {ctx.settings.facebook_url && (
                <a
                  href={ctx.settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {ctx.settings.youtube_url && (
                <a
                  href={ctx.settings.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              )}
              {ctx.settings.linkedin_url && (
                <a
                  href={ctx.settings.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {ctx.tenantNome} — site criado com{" "}
          <span className="font-semibold text-zinc-400">imoB365</span>
        </div>
      </footer>
    </div>
  );
}
