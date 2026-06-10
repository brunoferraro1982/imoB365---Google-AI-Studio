import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Phone, MessageCircle, MapPin, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/routes/index";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";

export const Route = createFileRoute("/corretor/$slug")({
  component: CorretorPublic,
});

type Corretor = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  creci: string | null;
  creci_uf: string | null;
  bio: string | null;
  foto_url: string | null;
  tenant_id: string;
};

type Imovel = {
  id: string;
  slug: string;
  titulo: string;
  finalidade: string;
  tipo: string;
  preco: number;
  endereco_cidade: string | null;
  endereco_uf: string | null;
};

function CorretorPublic() {
  const { slug } = Route.useParams();
  const [corretor, setCorretor] = useState<Corretor | null>(null);
  const [tenantNome, setTenantNome] = useState<string>("");
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [capas, setCapas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("corretores")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .eq("publico", true)
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      setCorretor(data as Corretor);
      const [{ data: tenant }, { data: imv }] = await Promise.all([
        supabase.from("tenants").select("nome").eq("id", data.tenant_id).maybeSingle(),
        supabase
          .from("imoveis")
          .select("id,slug,titulo,finalidade,tipo,preco,endereco_cidade,endereco_uf")
          .eq("corretor_responsavel_id", data.id)
          .eq("publicado", true)
          .eq("status", "ativo")
          .order("updated_at", { ascending: false }),
      ]);
      setTenantNome(tenant?.nome ?? "");
      const imoveisList = (imv as Imovel[]) ?? [];
      setImoveis(imoveisList);
      if (imoveisList.length) {
        const { data: fotos } = await supabase
          .from("imovel_fotos")
          .select("imovel_id,storage_path,capa")
          .in(
            "imovel_id",
            imoveisList.map((i) => i.id),
          )
          .eq("capa", true);
        const map: Record<string, string> = {};
        (fotos ?? []).forEach((f: { imovel_id: string; storage_path: string }) => {
          map[f.imovel_id] = supabase.storage
            .from("imovel-fotos")
            .getPublicUrl(f.storage_path).data.publicUrl;
        });
        setCapas(map);
      }
      setLoading(false);
    })();
  }, [slug]);

  function waLink(num: string) {
    const clean = num.replace(/\D/g, "");
    return `https://wa.me/${clean.startsWith("55") ? clean : "55" + clean}`;
  }

  if (loading)
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!corretor)
    return (
      <div className="p-16 text-center">
        <h1 className="text-2xl font-bold">Corretor não encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-xl border border-border bg-card p-6 text-center">
            {corretor.foto_url ? (
              <img
                src={corretor.foto_url}
                alt={corretor.nome}
                className="mx-auto h-32 w-32 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
                {corretor.nome
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <h1 className="mt-4 text-xl font-bold">{corretor.nome}</h1>
            {corretor.cargo && <p className="text-sm text-muted-foreground">{corretor.cargo}</p>}
            {corretor.creci && (
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" /> CRECI {corretor.creci}
                {corretor.creci_uf ? "/" + corretor.creci_uf : ""}
              </p>
            )}
            <div className="mt-6 space-y-2 text-left text-sm">
              {corretor.whatsapp && (
                <a
                  href={waLink(corretor.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {corretor.telefone && (
                <a
                  href={`tel:${corretor.telefone}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> {corretor.telefone}
                </a>
              )}
              {corretor.email && (
                <a
                  href={`mailto:${corretor.email}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted"
                >
                  <Mail className="h-4 w-4" /> {corretor.email}
                </a>
              )}
            </div>
            {tenantNome && (
              <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                Equipe da <span className="font-medium text-foreground">{tenantNome}</span>
              </p>
            )}
          </aside>

          <div>
            {corretor.bio && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold">Sobre</h2>
                <p className="whitespace-pre-wrap text-sm text-foreground/80">{corretor.bio}</p>
              </section>
            )}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Imóveis ({imoveis.length})</h2>
              {imoveis.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum imóvel publicado por este corretor no momento.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {imoveis.map((i) => (
                    <Link
                      key={i.id}
                      to="/imovel/$slug"
                      params={{ slug: i.slug }}
                      className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                    >
                      <div className="aspect-[4/3] bg-muted">
                        {capas[i.id] && (
                          <img
                            src={capas[i.id]}
                            alt={i.titulo}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-xs uppercase tracking-wide text-primary">
                          {FINALIDADE_LABEL[i.finalidade]} · {TIPO_LABEL[i.tipo]}
                        </p>
                        <h3 className="mt-1 line-clamp-1 font-semibold">{i.titulo}</h3>
                        {i.endereco_cidade && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {i.endereco_cidade}
                            {i.endereco_uf ? "/" + i.endereco_uf : ""}
                          </p>
                        )}
                        <p className="mt-2 font-bold text-primary">{formatBRL(i.preco)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
