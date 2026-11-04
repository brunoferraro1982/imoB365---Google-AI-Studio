import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";

export type MegaNavLeaf = {
  key: string;
  label: string;
  desc?: string;
  to?: string;
  hash?: string;
  href?: string;
  /** Ícone exibido no painel desktop (se omitido, o item não mostra ícone no desktop). */
  icon?: LucideIcon;
  iconClassName?: string;
  /** Classe extra no texto do label (ex.: item "Documentação API" tem o label em emerald-600 no desktop). */
  labelClassName?: string;
  /** Ícone exibido no menu mobile (se omitido, usa `icon`; fallback final é ChevronRight). */
  mobileIcon?: LucideIcon;
  /** Classes do "chip" de ícone no mobile, ex.: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white". */
  mobileChipClassName?: string;
  badge?: string;
  /** Item estático (não-clicável), ex.: card promocional — não aparece no menu mobile. */
  static?: boolean;
};

export type MegaNavColumn = {
  eyebrow?: string;
  leaves: MegaNavLeaf[];
};

export type MegaNavGroup = {
  key: string;
  label: string;
  /** Sem `columns`: grupo vira link simples (sem dropdown). */
  to?: string;
  hash?: string;
  /** Classes exatas do painel dropdown (posição/largura/grid) — preserva o desenho original por grupo. */
  panelClassName?: string;
  columns?: MegaNavColumn[];
  ctaLeaf?: { label: string; to: string };
  /** Título do grupo no menu mobile, se diferente do `label`. */
  mobileLabel?: string;
  /** Estilo mobile "achatado" (ícone + texto simples, sem chip nem descrição) — usado por Área Técnica. */
  flatMobileStyle?: boolean;
  /** Tema "brand": "topbar" mostra o grupo no top bar (desktop) em vez da barra principal. No mobile ele segue na gaveta. */
  posicao?: "menu" | "topbar";
  /** Ícone do gatilho quando o grupo fica no top bar. */
  icon?: LucideIcon;
};

export type MegaNavConfig = {
  logo: React.ReactNode;
  logoTo?: string;
  topBar?: {
    contacts: { icon: LucideIcon; label: string; href: string }[];
    nav?: React.ReactNode;
  };
  groups: MegaNavGroup[];
  ctaButton?: { label: string; to: string; icon?: LucideIcon };
  mobileQuickAction?: { label: string; to: string; icon?: LucideIcon };
  /** Escape hatch para CTAs bespoke no lado direito do header (ex.: HeaderUserMenu). */
  extraCtas?: () => React.ReactNode;
  /**
   * "padrao" (default): visual claro de sempre — usado pelos sites das imobiliárias.
   * "brand": portal imoB365 (padrão apple.com + Liquid Glass) — top bar preto,
   * menu cinza-escuro translúcido fixo ao rolar, ícones padronizados em tile de vidro.
   */
  tema?: "padrao" | "brand";
};

// ---------- variante "brand" (portal imoB365 · padrão apple.com + Liquid Glass) ----------
// Top bar preto + menu cinza-escuro translúcido, os dois fixos no topo ao rolar;
// painéis no mesmo vidro; ícones em tile de vidro com ícone laranja.

const MENU_VIDRO = "bg-[rgba(22,22,23,0.8)] backdrop-blur-[20px] backdrop-saturate-[1.8]";
const TEXTO_MENU = "text-[#e8e8ed]";

/** Ícone padronizado: tile de vidro com ícone laranja; no hover do item vira laranja sólido. */
function IconeVidro({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-white/15 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur transition-all duration-200 group-hover:border-transparent group-hover:bg-gradient-to-br group-hover:from-[#ed7d31] group-hover:to-[#b4520f] group-hover:ring-transparent group-hover:shadow-[0_6px_16px_-6px_rgba(237,125,49,0.7)]">
      <Icon className="h-4 w-4 text-[#ed7d31] transition-colors duration-200 group-hover:text-white" />
    </span>
  );
}

/** Mini-tile de vidro escuro para o top bar preto. */
export function IconeVidroTopo({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border border-white/15 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors duration-200 group-hover:bg-white/[0.14]">
      <Icon className="h-3 w-3 text-[#ed7d31]" aria-hidden="true" />
    </span>
  );
}

/** Troca só as classes de cor/borda/sombra do painel; posição e largura continuam do config. */
function painelBrand(cls?: string) {
  return (cls ?? "")
    .replace("border-border", "border-white/10")
    .replace(
      "bg-background",
      `bg-[rgba(22,22,23,0.88)] backdrop-blur-2xl backdrop-saturate-[1.8] ${TEXTO_MENU}`,
    )
    .replace("shadow-xl", "shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/5");
}

function BrandLeafConteudo({ leaf }: { leaf: MegaNavLeaf }) {
  return (
    <>
      {leaf.icon && <IconeVidro icon={leaf.icon} />}
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-xs font-bold text-[#f5f5f7] transition-colors group-hover:text-[#f4a46a]">
          {leaf.label}
          {leaf.badge && <BrandBadge>{leaf.badge}</BrandBadge>}
        </span>
        {leaf.desc && (
          <span className="mt-0.5 text-[10px] leading-snug text-[#a1a1a6]">{leaf.desc}</span>
        )}
      </span>
    </>
  );
}

function BrandBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#ed7d31]/30 bg-[#ed7d31]/15 px-1.5 py-px text-[8px] font-black uppercase tracking-widest text-[#f4a46a]">
      {children}
    </span>
  );
}

function BrandLeafLink({ leaf, onClick }: { leaf: MegaNavLeaf; onClick?: () => void }) {
  const cls =
    "group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.07]";
  if (leaf.to) {
    return (
      <Link to={leaf.to} hash={leaf.hash} className={cls} onClick={onClick}>
        <BrandLeafConteudo leaf={leaf} />
      </Link>
    );
  }
  if (leaf.href) {
    return (
      <a
        href={leaf.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        onClick={onClick}
      >
        <BrandLeafConteudo leaf={leaf} />
      </a>
    );
  }
  return null;
}

function BrandPanelColumn({ column }: { column: MegaNavColumn }) {
  return (
    <div className="space-y-3">
      {column.eyebrow && (
        <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#86868b]">
          {column.eyebrow}
        </span>
      )}
      <div className="space-y-1">
        {column.leaves.map((leaf) =>
          leaf.static ? (
            <div
              key={leaf.key}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3"
            >
              <BrandLeafConteudo leaf={leaf} />
            </div>
          ) : (
            <BrandLeafLink key={leaf.key} leaf={leaf} />
          ),
        )}
      </div>
    </div>
  );
}

function BrandMobileGroupSection({
  group,
  onNavigate,
}: {
  group: MegaNavGroup;
  onNavigate: () => void;
}) {
  const leaves = group.columns?.flatMap((c) => c.leaves).filter((l) => !l.static) ?? [];
  return (
    <div className="space-y-1">
      <h3 className="mb-2.5 px-3 text-[10px] font-extrabold uppercase tracking-widest text-[#86868b]">
        {group.mobileLabel ?? group.label}
      </h3>
      {leaves.map((leaf) => (
        <BrandLeafLink key={leaf.key} leaf={leaf} onClick={onNavigate} />
      ))}
    </div>
  );
}

function LeafLink({
  leaf,
  className,
  onClick,
}: {
  leaf: MegaNavLeaf;
  className: string;
  onClick?: () => void;
}) {
  if (leaf.to) {
    return (
      <Link key={leaf.key} to={leaf.to} hash={leaf.hash} className={className} onClick={onClick}>
        <span
          className={`text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5 ${leaf.labelClassName ?? "text-foreground"}`}
        >
          {leaf.icon && <leaf.icon className={`h-3.5 w-3.5 ${leaf.iconClassName ?? ""}`} />}
          {leaf.label}
        </span>
        {leaf.desc && (
          <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">{leaf.desc}</span>
        )}
      </Link>
    );
  }
  if (leaf.href) {
    return (
      <a
        key={leaf.key}
        href={leaf.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        <span
          className={`text-xs font-bold group-hover:text-primary transition-colors flex items-center gap-1.5 ${leaf.labelClassName ?? "text-foreground"}`}
        >
          {leaf.icon && <leaf.icon className={`h-3.5 w-3.5 ${leaf.iconClassName ?? ""}`} />}
          {leaf.label}
        </span>
        {leaf.desc && (
          <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">{leaf.desc}</span>
        )}
      </a>
    );
  }
  return null;
}

function DesktopPanelColumn({ column }: { column: MegaNavColumn }) {
  return (
    <div className="space-y-3">
      {column.eyebrow && (
        <span className="text-[10px] block font-extrabold uppercase tracking-widest text-muted-foreground/80">
          {column.eyebrow}
        </span>
      )}
      <div className="space-y-1">
        {column.leaves.map((leaf) =>
          leaf.static ? (
            <div
              key={leaf.key}
              className="p-3 bg-muted/40 rounded-xl border border-border/65 space-y-1.5"
            >
              {leaf.badge && (
                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-sky-200">
                  {leaf.badge}
                </span>
              )}
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                {leaf.icon && <leaf.icon className={`h-3.5 w-3.5 ${leaf.iconClassName ?? ""}`} />}
                {leaf.label}
              </h4>
              {leaf.desc && (
                <p className="text-[10px] text-muted-foreground leading-snug">{leaf.desc}</p>
              )}
            </div>
          ) : (
            <LeafLink
              key={leaf.key}
              leaf={leaf}
              className="flex flex-col p-2.5 rounded-xl hover:bg-muted/65 transition-colors group"
            />
          ),
        )}
      </div>
    </div>
  );
}

function MobileGroupSection({
  group,
  onNavigate,
}: {
  group: MegaNavGroup;
  onNavigate: () => void;
}) {
  const leaves = group.columns?.flatMap((c) => c.leaves).filter((l) => !l.static) ?? [];
  const sectionClassName = group.flatMobileStyle
    ? "space-y-1 border-t border-border/50 pt-3"
    : "space-y-1";
  return (
    <div className={sectionClassName}>
      <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/85 mb-2.5">
        {group.mobileLabel ?? group.label}
      </h3>
      {leaves.map((leaf) => {
        if (group.flatMobileStyle) {
          const FlatIcon = leaf.mobileIcon ?? leaf.icon ?? ChevronRight;
          return (
            <Link
              key={leaf.key}
              to={leaf.to}
              hash={leaf.hash}
              className="flex items-center gap-3.5 px-3 py-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
              onClick={onNavigate}
            >
              <FlatIcon className={`h-4 w-4 shrink-0 ${leaf.iconClassName ?? ""}`} />
              <span>{leaf.label}</span>
            </Link>
          );
        }
        const MobileIcon = leaf.mobileIcon ?? leaf.icon ?? ChevronRight;
        const chip =
          leaf.mobileChipClassName ??
          "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white";
        return (
          <Link
            key={leaf.key}
            to={leaf.to}
            hash={leaf.hash}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-primary/5 text-foreground font-semibold transition-all group"
            onClick={onNavigate}
          >
            <div className={`p-2 rounded-lg transition-colors ${chip}`}>
              <MobileIcon className="h-4 w-4" />
            </div>
            {leaf.desc ? (
              <div className="flex flex-col">
                <span>{leaf.label}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{leaf.desc}</span>
              </div>
            ) : (
              <span>{leaf.label}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function MegaNavHeader({ config }: { config: MegaNavConfig }) {
  if (config.tema === "brand") return <MegaNavHeaderBrand config={config} />;
  return <MegaNavHeaderPadrao config={config} />;
}

function MegaNavHeaderPadrao({ config }: { config: MegaNavConfig }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  const handleMouseEnter = (key: string) => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(key);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => setActiveMenu(null), 220);
    setMenuTimeout(timeout);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md shadow-xs transition-all duration-300 font-sans">
      {config.topBar && (
        <div className="bg-neutral-950 text-white text-[11px] font-semibold py-2 px-6 border-b border-white/5">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-5 text-white/80 w-full sm:w-auto">
              {config.topBar.contacts.map((c, i) => (
                <Fragment key={c.label}>
                  {i > 0 && <span className="hidden sm:inline text-white/20 select-none">|</span>}
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-2 hover:text-primary transition-colors duration-200"
                  >
                    <c.icon className="h-3.5 w-3.5 text-primary shrink-0 transition-transform hover:scale-110" />
                    <span>{c.label}</span>
                  </a>
                </Fragment>
              ))}
            </div>
            {config.topBar.nav}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 relative">
        <Link
          to={config.logoTo ?? "/"}
          className="flex shrink-0 items-center transition-transform hover:scale-[1.015]"
        >
          {config.logo}
        </Link>

        <nav className="hidden items-center gap-0.5 xl:gap-1.5 lg:flex text-[13px] xl:text-sm font-semibold text-foreground/85 tracking-tight xl:tracking-normal shrink-0">
          {config.groups.map((group) => {
            if (!group.columns || group.columns.length === 0) {
              return (
                <Link
                  key={group.key}
                  to={group.to}
                  hash={group.hash}
                  className="flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap hover:bg-muted/50 hover:text-foreground"
                >
                  <span>{group.label}</span>
                </Link>
              );
            }
            const isActive = activeMenu === group.key;
            return (
              <div
                key={group.key}
                className="relative"
                onMouseEnter={() => handleMouseEnter(group.key)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive ? "bg-muted text-primary" : "hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${isActive ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className={group.panelClassName}
                    >
                      {group.columns!.length > 1 ? (
                        group.columns!.map((col, i) => (
                          <div
                            key={col.eyebrow ?? i}
                            className={i > 0 ? "border-l border-border/60 pl-4" : undefined}
                          >
                            <DesktopPanelColumn column={col} />
                          </div>
                        ))
                      ) : (
                        <>
                          <DesktopPanelColumn column={group.columns![0]} />
                          {group.ctaLeaf && (
                            <div className="pt-2 mt-1 border-t border-border/40">
                              <Link
                                to={group.ctaLeaf.to}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-white hover:bg-primary/90 transition-colors"
                                onClick={() => setActiveMenu(null)}
                              >
                                {group.ctaLeaf.label}
                              </Link>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {config.ctaButton && (
            <Link
              to={config.ctaButton.to}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[#e86620] hover:from-[#e86620] hover:to-orange-500 text-white px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              {config.ctaButton.icon && <config.ctaButton.icon className="h-3.8 w-3.8 shrink-0" />}
              <span>{config.ctaButton.label}</span>
            </Link>
          )}

          {config.extraCtas?.()}

          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="Menu de navegação"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[310px] sm:w-[370px] p-0 flex flex-col bg-background/95 backdrop-blur-md"
              >
                <SheetHeader className="px-6 py-5 border-b border-border/50">
                  <SheetTitle className="text-left font-bold tracking-tight text-foreground flex items-center justify-between">
                    <span className="shrink-0">{config.logo}</span>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 text-xs">
                  {config.mobileQuickAction && (
                    <div className="px-3 pb-2">
                      <Link
                        to={config.mobileQuickAction.to}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-[#e86620] px-4 py-3.5 text-xs font-black text-white shadow-sm hover:scale-[1.01] transition-all text-center"
                        onClick={closeMobile}
                      >
                        {config.mobileQuickAction.icon && (
                          <config.mobileQuickAction.icon className="h-4.5 w-4.5 shrink-0" />
                        )}
                        <span>{config.mobileQuickAction.label}</span>
                      </Link>
                    </div>
                  )}

                  {config.groups.map((group) =>
                    group.to && (!group.columns || group.columns.length === 0) ? (
                      <Link
                        key={group.key}
                        to={group.to}
                        hash={group.hash}
                        className="flex items-center gap-3.5 px-3 py-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
                        onClick={closeMobile}
                      >
                        <span>{group.mobileLabel ?? group.label}</span>
                      </Link>
                    ) : (
                      <MobileGroupSection key={group.key} group={group} onNavigate={closeMobile} />
                    ),
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Header do portal imoB365 (tema "brand", padrão apple.com): top bar PRETO +
 * menu cinza-escuro translúcido (vidro, valores da barra
 * da Apple) — os dois FIXOS no topo ao rolar; painéis e menu mobile no mesmo vidro; logo branco.
 * Mesma lógica de hover/dropdown/mobile do header padrão — só o visual muda.
 */
function MegaNavHeaderBrand({ config }: { config: MegaNavConfig }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  const handleMouseEnter = (key: string) => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(key);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => setActiveMenu(null), 220);
    setMenuTimeout(timeout);
  };

  // Grupos marcados com posicao "topbar" (ex.: "A imoB365") saem da barra principal no desktop
  const gruposTopo = config.groups.filter((g) => g.posicao === "topbar");
  const gruposMenu = config.groups.filter((g) => g.posicao !== "topbar");

  return (
    // Top bar + menu num único bloco FIXO no topo ao rolar
    <header className="sticky top-0 z-40 font-sans">
      {/* Top bar preto (compacto: menos altura, mesmas fontes) */}
      {config.topBar && (
        <div className="relative z-20 bg-black px-6 py-1 text-[11px] font-semibold text-white/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex shrink-0 items-center gap-5">
              {config.topBar.contacts.map((c, i) => (
                <Fragment key={c.label}>
                  {i > 0 && <span className="hidden select-none text-white/20 sm:inline">|</span>}
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="group flex items-center gap-2 whitespace-nowrap transition-colors duration-200 hover:text-white"
                  >
                    <IconeVidroTopo icon={c.icon} />
                    <span>{c.label}</span>
                  </a>
                </Fragment>
              ))}
            </div>
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
              {gruposTopo.map((group) => {
                const isActive = activeMenu === group.key;
                return (
                  <div
                    key={group.key}
                    className="relative hidden lg:block"
                    onMouseEnter={() => handleMouseEnter(group.key)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      className={`group flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12.5px] font-semibold transition-colors ${
                        isActive
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {group.icon && <IconeVidroTopo icon={group.icon} />}
                      <span>{group.label}</span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform duration-200 ${isActive ? "rotate-180 text-[#ed7d31]" : "opacity-60"}`}
                      />
                    </button>
                    <AnimatePresence>
                      {isActive && group.columns && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className={painelBrand(group.panelClassName)}
                        >
                          <BrandPanelColumn column={group.columns[0]} />
                          {group.ctaLeaf && (
                            <div className="mt-1 border-t border-white/10 pt-2">
                              <Link
                                to={group.ctaLeaf.to}
                                className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#ed7d31] to-[#b4520f] px-3 py-2 text-[11px] font-bold text-white shadow-md shadow-[#ed7d31]/25 transition hover:brightness-110"
                                onClick={() => setActiveMenu(null)}
                              >
                                {group.ctaLeaf.label}
                              </Link>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {config.topBar.nav}
            </div>
          </div>
        </div>
      )}

      {/* Menu cinza-escuro em vidro (rgba(22,22,23,.8), como a Apple). O vidro (fundo + blur)
          fica numa camada irmã dos painéis — se ficasse no ancestral, viraria "backdrop root"
          e os painéis não conseguiriam desfocar a página. */}
      <div className="relative z-10 isolate border-b border-white/10">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 ${MENU_VIDRO}`}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2">
          <Link
            to={config.logoTo ?? "/"}
            className="flex shrink-0 items-center transition-transform hover:scale-[1.015]"
          >
            {config.logo}
          </Link>

          <nav
            className={`hidden shrink-0 items-center gap-0.5 text-[13px] font-semibold tracking-tight text-[#e8e8ed]/90 lg:flex xl:gap-1.5 xl:text-sm xl:tracking-normal`}
          >
            {gruposMenu.map((group) => {
              if (!group.columns || group.columns.length === 0) {
                return (
                  <Link
                    key={group.key}
                    to={group.to}
                    hash={group.hash}
                    className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 transition-colors hover:bg-white/10 hover:text-white xl:px-3"
                  >
                    <span>{group.label}</span>
                  </Link>
                );
              }
              const isActive = activeMenu === group.key;
              return (
                <div
                  key={group.key}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(group.key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    className={`flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 transition-colors xl:px-3 ${
                      isActive ? "bg-white/10 text-white" : "hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "rotate-180 text-[#ed7d31]" : "opacity-60"}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={painelBrand(group.panelClassName)}
                      >
                        {group.columns!.length > 1 ? (
                          group.columns!.map((col, i) => (
                            <div
                              key={col.eyebrow ?? i}
                              className={i > 0 ? "border-l border-white/10 pl-4" : undefined}
                            >
                              <BrandPanelColumn column={col} />
                            </div>
                          ))
                        ) : (
                          <>
                            <BrandPanelColumn column={group.columns![0]} />
                            {group.ctaLeaf && (
                              <div className="mt-1 border-t border-white/10 pt-2">
                                <Link
                                  to={group.ctaLeaf.to}
                                  className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#ed7d31] to-[#b4520f] px-3 py-2 text-[11px] font-bold text-white shadow-md shadow-[#ed7d31]/25 transition hover:brightness-110"
                                  onClick={() => setActiveMenu(null)}
                                >
                                  {group.ctaLeaf.label}
                                </Link>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {config.ctaButton && (
              <Link
                to={config.ctaButton.to}
                className="hidden cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[#ed7d31] to-[#b4520f] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#ed7d31]/25 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 sm:inline-flex"
              >
                {config.ctaButton.icon && <config.ctaButton.icon className="h-4 w-4 shrink-0" />}
                <span>{config.ctaButton.label}</span>
              </Link>
            )}

            {config.extraCtas?.()}

            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-[#e8e8ed] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Menu de navegação"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className={`flex w-[310px] flex-col border-white/10 p-0 [&>button]:text-white sm:w-[370px] ${MENU_VIDRO} ${TEXTO_MENU}`}
                >
                  <SheetHeader className="border-b border-white/10 px-6 py-5">
                    <SheetTitle className="flex items-center justify-between text-left font-bold tracking-tight">
                      <span className="shrink-0">{config.logo}</span>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 text-xs">
                    {config.mobileQuickAction && (
                      <div className="px-3 pb-2">
                        <Link
                          to={config.mobileQuickAction.to}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ed7d31] to-[#b4520f] px-4 py-3.5 text-center text-xs font-black text-white shadow-md shadow-[#ed7d31]/25 transition-all hover:scale-[1.01]"
                          onClick={closeMobile}
                        >
                          {config.mobileQuickAction.icon && (
                            <config.mobileQuickAction.icon className="h-4.5 w-4.5 shrink-0" />
                          )}
                          <span>{config.mobileQuickAction.label}</span>
                        </Link>
                      </div>
                    )}

                    {config.groups.map((group) =>
                      group.to && (!group.columns || group.columns.length === 0) ? (
                        <Link
                          key={group.key}
                          to={group.to}
                          hash={group.hash}
                          className="flex items-center gap-3.5 px-3 py-2 font-semibold text-[#a1a1a6] transition-colors hover:text-white"
                          onClick={closeMobile}
                        >
                          <span>{group.mobileLabel ?? group.label}</span>
                        </Link>
                      ) : (
                        <BrandMobileGroupSection
                          key={group.key}
                          group={group}
                          onNavigate={closeMobile}
                        />
                      ),
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
