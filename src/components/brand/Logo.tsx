
export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Top-left clipping half diagonal from bottom-left to top-right over 24x24 box */}
        <clipPath id="logo-icon-clip-top-left">
          <rect x="-24" y="-48" width="48" height="48" transform="rotate(-45) translate(0, -0.6)" />
        </clipPath>
        {/* Bottom-right clipping half diagonal over 24x24 box */}
        <clipPath id="logo-icon-clip-bottom-right">
          <rect x="-24" y="0" width="48" height="48" transform="rotate(-45) translate(0, 0.6)" />
        </clipPath>
      </defs>
      
      {/* Dynamic orange split ring icon */}
      <g transform="translate(12, 12)">
        {/* Top-left shifted half */}
        <g clipPath="url(#logo-icon-clip-top-left)" transform="translate(-1, -1)">
          <circle cx="0" cy="0" r="7.5" stroke="#F27A24" strokeWidth="4.6" />
        </g>
        {/* Bottom-right shifted half */}
        <g clipPath="url(#logo-icon-clip-bottom-right)" transform="translate(1, 1)">
          <circle cx="0" cy="0" r="7.5" stroke="#F27A24" strokeWidth="4.6" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({
  className = "h-9 w-auto",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "white";
}) {
  const textColor = variant === "white" ? "#FFFFFF" : "#0F172A";

  return (
    <svg
      viewBox="0 0 115 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Top-left clipping half diagonal inside a local 40x40 area */}
        <clipPath id="logo-clip-top-left">
          <rect x="-20" y="-40" width="40" height="40" transform="rotate(-45) translate(0, -0.5)" />
        </clipPath>
        {/* Bottom-right clipping half diagonal inside a local 40x40 area */}
        <clipPath id="logo-clip-bottom-right">
          <rect x="-20" y="0" width="40" height="40" transform="rotate(-45) translate(0, 0.5)" />
        </clipPath>
      </defs>

      {/* "im" prefix with compact letter-spacing and heavy weight */}
      <text
        x="1"
        y="23.5"
        fontFamily="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="21"
        fill={textColor}
        letterSpacing="-0.04em"
      >
        im
      </text>

      {/* The iconic diagonal split-ring 'o' of the brand */}
      <g transform="translate(36, 16.5)">
        {/* Top-left shifted half */}
        <g clipPath="url(#logo-clip-top-left)" transform="translate(-0.8, -0.8)">
          <circle cx="0" cy="0" r="7.2" stroke="#F27A24" strokeWidth="4.4" />
        </g>
        {/* Bottom-right shifted half */}
        <g clipPath="url(#logo-clip-bottom-right)" transform="translate(0.8, 0.8)">
          <circle cx="0" cy="0" r="7.2" stroke="#F27A24" strokeWidth="4.4" />
        </g>
      </g>

      {/* "B365" suffix */}
      <text
        x="48"
        y="23.5"
        fontFamily="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="21"
        fill={textColor}
        letterSpacing="-0.04em"
      >
        B365
      </text>
    </svg>
  );
}

export function LogoMark({ className = "h-7 w-auto font-display font-extrabold tracking-tight text-foreground" }: { className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <LogoIcon className="h-6 w-6" />
      <span className={className}>
        imob365
      </span>
    </div>
  );
}
