import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Heart, Bookmark, User, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(nome: string | null | undefined, email: string | null | undefined) {
  const base = (nome && nome.trim()) || (email ?? "");
  if (!base) return "U";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function HeaderUserMenu() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link to="/login">
          <Button variant="outline" size="sm" className="rounded-full font-bold tracking-wide border-border/80 text-foreground/90 hover:text-primary hover:border-primary/45 hover:bg-muted/40 transition-all flex items-center gap-2 px-4 shadow-2xs">
            <User className="h-4 w-4 stroke-[2.25px] text-muted-foreground" />
            <span>Entrar</span>
          </Button>
        </Link>
        <Link to="/signup">
          <Button size="sm" className="rounded-full font-extrabold tracking-wide bg-gradient-to-r from-primary via-[#e86620] to-orange-500 text-white shadow-sm hover:shadow-lg hover:shadow-primary/20 hover:scale-105 active:scale-98 transition-all duration-300 flex items-center gap-1.5 px-4.5 border border-primary/10">
            <PlusCircle className="h-4 w-4 stroke-[2.5px] animate-pulse" />
            <span>Anunciar imóvel</span>
          </Button>
        </Link>
      </div>
    );
  }

  const nome = profile?.nome ?? user.email ?? "Usuário";
  const avatar = profile?.avatar_url ?? (user.user_metadata as any)?.avatar_url ?? null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex items-center gap-3">
      <Link to="/app">
        <Button size="sm" className="rounded-full font-extrabold tracking-wide bg-gradient-to-r from-primary via-[#e86620] to-orange-500 text-white shadow-sm hover:shadow-lg hover:shadow-primary/20 hover:scale-105 active:scale-98 transition-all duration-300 flex items-center gap-1.5 px-4.5 border border-primary/10">
          <PlusCircle className="h-4 w-4 stroke-[2.5px] animate-pulse" />
          <span>Anunciar imóvel</span>
        </Button>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-full border border-border/85 bg-card/90 pl-1.5 pr-3 py-1.5 transition-all shadow-2xs hover:bg-muted/70 hover:border-primary/25 cursor-pointer">
            <Avatar className="h-7 w-7 ring-2 ring-primary/10">
              {avatar && <AvatarImage src={avatar} alt={nome} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{initials(profile?.nome, user.email)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[124px] truncate text-xs font-semibold tracking-wide text-foreground md:inline">{nome}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate text-sm font-medium">{nome}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> Painel
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/conta" className="flex items-center gap-2">
              <User className="h-4 w-4" /> Minha conta
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/conta/favoritos" className="flex items-center gap-2">
              <Heart className="h-4 w-4" /> Meus favoritos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/conta/buscas" className="flex items-center gap-2">
              <Bookmark className="h-4 w-4" /> Minhas buscas
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}