import { useState } from "react";
import { Apple, Instagram, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Provider = "google" | "apple" | "linkedin_oidc" | "facebook";

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  linkedin_oidc: "LinkedIn",
  facebook: "Instagram",
};

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

const PROVIDERS: { provider: Provider; icon: React.ReactNode }[] = [
  { provider: "google", icon: <GoogleIcon /> },
  { provider: "apple", icon: <Apple className="h-4 w-4" /> },
  { provider: "linkedin_oidc", icon: <Linkedin className="h-4 w-4 text-[#0A66C2]" /> },
  { provider: "facebook", icon: <Instagram className="h-4 w-4 text-[#E1306C]" /> },
];

// Design único compartilhado entre o mega menu (HeaderUserMenu) e o /signup —
// login via Instagram é sempre, por baixo, OAuth do Facebook (Meta), não
// existe provider nativo de "Instagram Login" no Supabase/GoTrue.
export function SocialLoginButtons({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleOAuthLogin(provider: Provider) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      toast.error(`Erro ao conectar com ${PROVIDER_LABEL[provider]}: ${error.message}`);
    }
  }

  return (
    <div className={cn("grid grid-cols-4 gap-1.5", className)}>
      {PROVIDERS.map(({ provider, icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => handleOAuthLogin(provider)}
          disabled={loading}
          className="flex flex-col items-center gap-1 rounded-lg border border-border/60 p-2 transition-all hover:border-primary/30 hover:bg-muted/40 disabled:opacity-50 group"
        >
          {icon}
          <span className="text-[8px] font-bold text-muted-foreground group-hover:text-foreground">
            {PROVIDER_LABEL[provider]}
          </span>
        </button>
      ))}
    </div>
  );
}
