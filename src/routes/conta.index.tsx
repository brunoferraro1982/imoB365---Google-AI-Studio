import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Bookmark, Calendar, MessageCircle, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listarFavoritoIds } from "@/lib/favoritos.functions";
import { listarBuscas } from "@/lib/buscas-salvas.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/conta/")({
  head: () => ({ meta: [{ title: "Minha conta — imob365" }] }),
  component: DashboardConta,
});

function DashboardConta() {
  const { user, profile } = useAuth();
  const listarIds = useServerFn(listarFavoritoIds);
  const listarBuscasFn = useServerFn(listarBuscas);
  const [favoritos, setFavoritos] = useState<number>(0);
  const [buscas, setBuscas] = useState<number>(0);
  const [visitas, setVisitas] = useState<number>(0);
  const [conversas, setConversas] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    listarIds().then((r) => setFavoritos((r.ids ?? []).length)).catch(() => {});
    listarBuscasFn().then((r) => setBuscas((r.buscas ?? []).length)).catch(() => {});
    (supabase.rpc as any)("public_minhas_visitas").then(({ data }: any) => setVisitas((data ?? []).length));
    supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("interessado_user_id", user.id)
      .then(({ count }) => setConversas(count ?? 0));
  }, [user, listarIds, listarBuscasFn]);

  const nome = profile?.nome ?? user?.email ?? "";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Olá{nome ? `, ${nome.split(" ")[0]}` : ""}!</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acompanhe seus imóveis salvos, buscas e visitas.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card to="/conta/favoritos" icon={Heart} label="Favoritos" value={favoritos} />
        <Card to="/conta/buscas" icon={Bookmark} label="Buscas salvas" value={buscas} />
        <Card to="/conta/visitas" icon={Calendar} label="Visitas" value={visitas} />
        <Card to="/conta/chat" icon={MessageCircle} label="Conversas" value={conversas} />
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Procurando um imóvel novo?</p>
        <Link to="/buscar" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Explorar imóveis disponíveis <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Card({ to, icon: Icon, label, value }: { to: string; icon: typeof Heart; label: string; value: number }) {
  return (
    <Link to={to as any} className="group rounded-xl border border-border bg-card p-5 transition hover:shadow-md hover:border-primary/30">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-primary" />
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}