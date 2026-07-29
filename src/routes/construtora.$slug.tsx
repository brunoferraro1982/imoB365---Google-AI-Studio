import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Factory, Globe, Mail, MapPin, Phone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/construtora/$slug")({
  component: ConstrutoraPublic,
});

type Construtora = {
  id: string;
  nome: string;
  logo_url: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  descricao: string | null;
};

type Empreendimento = {
  id: string;
  slug: string;
  nome: string;
  fase: string;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  fotos_urls: string[];
};

function ConstrutoraPublic() {
  const { slug } = Route.useParams();
  const [construtora, setConstrutora] = useState<Construtora | null>(null);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [parceiras, setParceiras] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("construtoras")
        .select("id,nome,logo_url,telefone,email,site,endereco_cidade,endereco_uf,descricao")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      setConstrutora(data as Construtora);
      const [{ data: emps }, { data: parceriasData }] = await Promise.all([
        supabase
          .from("empreendimentos")
          .select("id,slug,nome,fase,endereco_cidade,endereco_uf,fotos_urls")
          .eq("construtora_id", data.id)
          .eq("publicado", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("construtora_tenant_parceria")
          .select("tenants(nome)")
          .eq("construtora_id", data.id)
          .eq("status", "ativo"),
      ]);
      setEmpreendimentos((emps ?? []) as Empreendimento[]);
      setParceiras(
        ((parceriasData ?? []) as { tenants: { nome: string } | null }[])
          .map((p) => p.tenants?.nome)
          .filter((n): n is string => !!n),
      );
      setLoading(false);
    })();
  }, [slug]);

  if (loading)
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!construtora)
    return (
      <div className="p-16 text-center">
        <h1 className="text-2xl font-bold">Construtora não encontrada</h1>
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
            {construtora.logo_url ? (
              <img
                src={construtora.logo_url}
                alt={construtora.nome}
                className="mx-auto h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Factory className="h-10 w-10" />
              </div>
            )}
            <h1 className="mt-4 text-xl font-bold">{construtora.nome}</h1>
            {(construtora.endereco_cidade || construtora.endereco_uf) && (
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {[construtora.endereco_cidade, construtora.endereco_uf].filter(Boolean).join("/")}
              </p>
            )}
            <div className="mt-6 space-y-2 text-left text-sm">
              {construtora.site && (
                <a
                  href={
                    construtora.site.startsWith("http")
                      ? construtora.site
                      : `https://${construtora.site}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90"
                >
                  <Globe className="h-4 w-4" /> Site oficial
                </a>
              )}
              {construtora.telefone && (
                <a
                  href={`tel:${construtora.telefone}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> {construtora.telefone}
                </a>
              )}
              {construtora.email && (
                <a
                  href={`mailto:${construtora.email}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted"
                >
                  <Mail className="h-4 w-4" /> {construtora.email}
                </a>
              )}
            </div>
            {parceiras.length > 0 && (
              <div className="mt-6 border-t border-border pt-4 text-left">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> Imobiliárias parceiras
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parceiras.map((nome) => (
                    <span
                      key={nome}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                    >
                      {nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div>
            {construtora.descricao && (
              <section className="mb-8">
                <h2 className="mb-2 text-lg font-semibold">Sobre</h2>
                <p className="whitespace-pre-wrap text-sm text-foreground/80">
                  {construtora.descricao}
                </p>
              </section>
            )}
            <section>
              <h2 className="mb-4 text-lg font-semibold">
                Empreendimentos ({empreendimentos.length})
              </h2>
              {empreendimentos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum empreendimento publicado desta construtora no momento.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {empreendimentos.map((e) => (
                    <Link
                      key={e.id}
                      to="/empreendimento/$slug"
                      params={{ slug: e.slug }}
                      className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                    >
                      <div className="aspect-[4/3] bg-muted">
                        {e.fotos_urls?.[0] && (
                          <img
                            src={e.fotos_urls[0]}
                            alt={e.nome}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="line-clamp-1 font-semibold">{e.nome}</h3>
                        {e.endereco_cidade && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {e.endereco_cidade}
                            {e.endereco_uf ? "/" + e.endereco_uf : ""}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
