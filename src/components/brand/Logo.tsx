import { useState } from "react";
import logoDark from "../../assets/logo-imob365.png";
import logoWhite from "../../assets/logo-imob365-white.png";

function resolveAssetUrl(importedAsset: any, fallbackPath: string): string {
  if (!importedAsset) return fallbackPath;
  if (typeof importedAsset === "string") return importedAsset;
  if (typeof importedAsset === "object" && importedAsset !== null) {
    if (typeof importedAsset.default === "string") return importedAsset.default;
  }
  return fallbackPath;
}

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/favicon.png"
      alt="imoB365"
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function Logo({
  className = "h-9 w-auto",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "white";
}) {
  const [errorCount, setErrorCount] = useState(0);

  // Try different URLs based on error level
  let src = "";
  if (errorCount === 0) {
    src = resolveAssetUrl(variant === "white" ? logoWhite : logoDark, variant === "white" ? "/logo-imob365-white.png" : "/logo-imob365.png");
  } else if (errorCount === 1) {
    src = variant === "white" ? "/logo-imob365-white.png" : "/logo-imob365.png";
  } else if (errorCount === 2) {
    src = variant === "white" ? `${window.location.origin}/logo-imob365-white.png` : `${window.location.origin}/logo-imob365.png`;
  }

  // Fallback to beautiful pure React typographic representation if image loading has issues
  if (errorCount >= 3) {
    const textColor = variant === "white" ? "text-white" : "text-neutral-900 dark:text-white";
    return (
      <div className={`inline-flex items-center gap-1 font-sans select-none tracking-tight ${className}`}>
        <span className={`font-extrabold leading-none ${textColor} tracking-tight`}>
          im
        </span>
        <span className="text-[#F2762E] font-extrabold">o</span>
        <span className={`font-black leading-none ${textColor} tracking-tight`}>
          B365
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="imoB365"
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setErrorCount((prev) => prev + 1);
      }}
    />
  );
}

export function LogoMark({ className = "h-7 w-auto font-display font-extrabold tracking-tight text-foreground" }: { className?: string }) {
  return (
    <span className={`${className} inline-flex items-center gap-1`}>
      <span>im</span>
      <LogoIcon className="h-[0.7em] w-[0.7em]" />
      <span>b365</span>
    </span>
  );
}
