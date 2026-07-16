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
};

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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

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
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md shadow-xs transition-all duration-300 font-sans">
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
          className="flex items-center transition-transform hover:scale-[1.015]"
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
            <Sheet>
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
                    {config.logo}
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 text-xs">
                  {config.mobileQuickAction && (
                    <div className="px-3 pb-2">
                      <Link
                        to={config.mobileQuickAction.to}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-[#e86620] px-4 py-3.5 text-xs font-black text-white shadow-sm hover:scale-[1.01] transition-all text-center"
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
                      >
                        <span>{group.mobileLabel ?? group.label}</span>
                      </Link>
                    ) : (
                      <MobileGroupSection key={group.key} group={group} onNavigate={() => {}} />
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
