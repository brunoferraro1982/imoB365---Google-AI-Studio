import logoIconImg from "@/assets/logo-icon.png";
import logoDarkImg from "@/assets/logo-imob365.png";
import logoWhiteImg from "@/assets/logo-imob365-white.png";

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  // width/height intrínsecos (não apenas via CSS) — é o que faz o navegador
  // derivar corretamente a largura a partir da altura fixa (h-8 etc.) quando
  // o elemento vira item de um container flex (ex: header); sem isso, o
  // flex-basis "auto" de um <img> só com altura definida resolve pra 0.
  // shrink-0: garante que a logo nunca seja espremida pelo flex-shrink padrão.
  return (
    <img src={logoIconImg} alt="" width={264} height={283} className={`${className} shrink-0`} />
  );
}

export function Logo({
  className = "h-9 w-auto",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "white";
}) {
  return (
    <img
      src={variant === "white" ? logoWhiteImg : logoDarkImg}
      alt="imoB365"
      width={1871}
      height={352}
      className={`${className} shrink-0`}
    />
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
