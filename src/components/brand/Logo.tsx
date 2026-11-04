import type { CSSProperties } from "react";
import eloGlass64 from "@/assets/brand/elo-glass-64px.png";
import eloGlass128 from "@/assets/brand/elo-glass-128px.png";
import glassPreto400 from "@/assets/brand/logo-glass-preto-400w.png";
import glassPreto800 from "@/assets/brand/logo-glass-preto-800w.png";
import glassBranco400 from "@/assets/brand/logo-glass-branco-400w.png";
import glassBranco800 from "@/assets/brand/logo-glass-branco-800w.png";
import chapadoPreto200 from "@/assets/brand/logo-chapado-preto-200w.png";
import chapadoPreto400 from "@/assets/brand/logo-chapado-preto-400w.png";
import chapadoBranco200 from "@/assets/brand/logo-chapado-branco-200w.png";
import chapadoBranco400 from "@/assets/brand/logo-chapado-branco-400w.png";

// Logo Liquid Glass 2026 (brand system imoB365):
// - "dark"  = letras pretas, vidro fosco — para fundos claros
// - "white" = letras brancas, vidro claro — para fundos escuros
// - flat    = versão chapada original, para larguras abaixo de 120 px
// O brilho/sombra já vem no PNG; o .logo-glass (styles.css) acrescenta a
// camada de desfoque do fundo recortada na silhueta do próprio logo.

// width/height intrínsecos (não apenas via CSS) — é o que faz o navegador
// derivar corretamente a largura a partir da altura fixa (h-8 etc.) quando o
// elemento vira item de um container flex; sem isso, o flex-basis "auto" de um
// <img> só com altura definida resolve pra 0. Proporção dos PNGs: 400×97.
const LOGO_W = 400;
const LOGO_H = 97;

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={eloGlass64}
      srcSet={`${eloGlass64} 1x, ${eloGlass128} 2x`}
      alt=""
      width={64}
      height={64}
      className={`${className} shrink-0`}
    />
  );
}

export function Logo({
  className = "h-9 w-auto",
  variant = "dark",
  flat = false,
}: {
  className?: string;
  variant?: "dark" | "white";
  flat?: boolean;
}) {
  const branco = variant === "white";
  if (flat) {
    const [x1, x2] = branco
      ? [chapadoBranco200, chapadoBranco400]
      : [chapadoPreto200, chapadoPreto400];
    return (
      <img
        src={x1}
        srcSet={`${x1} 1x, ${x2} 2x`}
        alt="imoB365"
        width={LOGO_W}
        height={LOGO_H}
        className={`${className} shrink-0`}
      />
    );
  }
  const [x1, x2] = branco ? [glassBranco400, glassBranco800] : [glassPreto400, glassPreto800];
  return (
    <span
      className={`logo-glass ${branco ? "logo-glass--claro" : "logo-glass--fosco"} ${className}`}
      style={{ "--logo-mask": `url(${x1})` } as CSSProperties}
    >
      <img
        src={x1}
        srcSet={`${x1} 1x, ${x2} 2x`}
        alt="imoB365"
        width={LOGO_W}
        height={LOGO_H}
        className="h-full w-auto"
      />
    </span>
  );
}

export function LogoMark({
  className = "h-7 w-auto font-display font-extrabold tracking-tight text-foreground",
}: {
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <LogoIcon className="h-6 w-6" />
      <span className={className}>imob365</span>
    </div>
  );
}
