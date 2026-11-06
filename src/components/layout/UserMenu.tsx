import { Link } from "@tanstack/react-router";
import { LogOut, Monitor, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme/ThemeProvider";

/** Opções de tema: o escuro só é aplicado quando o usuário escolhe (padrão: claro). */
export const TEMA_OPCOES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
] as const;

/**
 * Menu do usuário na barra utilitária: e-mail, escolha de tema (salva no
 * perfil), atalho do super-admin e sair. Substitui o botão de tema e o e-mail
 * que ficavam espremidos no header.
 */
export function UserMenu({
  email,
  isSuperAdmin,
  onSignOut,
}: {
  email: string;
  isSuperAdmin: boolean;
  onSignOut: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const inicial = (email.trim()[0] ?? "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menu do usuário"
          className="h-9 w-9 rounded-full bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <span className="text-xs font-bold">{inicial}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
          {TEMA_OPCOES.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <o.icon className="mr-2 h-4 w-4" /> {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuItem asChild>
          <Link to="/app/contratacao">
            <Sparkles className="mr-2 h-4 w-4" /> Planos & Assinatura
          </Link>
        </DropdownMenuItem>
        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <ShieldCheck className="mr-2 h-4 w-4" /> Super-admin
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
