import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Bed, Bath, Maximize2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { TrackingPixels } from "@/components/site/TrackingPixels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBRL, FINALIDADE_LABEL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/site/$slug")({
  component: TenantHome,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Imóveis` },
      { property: "og:title", content: `${params.slug} — Imóveis` },
      { property: "og:url", content: `/site/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/site/${params.slug}` }],
  }),
});

function photoUrl(path: string) {
  return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
}

function TenantHome() {
  const { slug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [hero, setHero] = useState<any>({});
  const [sobre, setSobre] = useState<string>("");
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      const [{ data: cfg }, { data: pages }, { data: imv }] = await Promise.all([
        supabase
          .from("tenant_site_settings")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("publicado", true)
          .maybeSingle(),
        supabase
          .from("tenant_pages")
          .select("slug,titulo")
          .eq("tenant_id", tenant.id)
          .eq("publicada", true)
          .order("ordem"),
        supabase
          .from("imoveis")
          .select(
            "id,slug,titulo,tipo,finalidade,preco,quartos,banheiros,area_util,endereco_bairro,endereco_cidade,endereco_uf",
          )
          .eq("tenant_id", tenant.id)
          .eq("publicado", true)
          .eq("status", "ativo")
          .order("publicado_em", { ascending: false })
          .limit(12),
      ]);
      if (!cfg) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      setCtx({
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        settings: cfg,
        pages: (pages ?? []) as any,
      });
      setHero(cfg);
      setSobre(cfg.sobre_html ?? "");
      setImoveis(imv ?? []);
      if (imv && imv.length) {
        const { data: fotos } = await supabase
          .from("imovel_fotos")
          .select("imovel_id,storage_path,capa,ordem")
          .in(
            "imovel_id",
            imv.map((i) => i.id),
          )
          .order("capa", { ascending: false })
          .order("ordem");
        const map: Record<string, string> = {};
        (fotos ?? []).forEach((f) => {
          if (!map[f.imovel_id]) map[f.imovel_id] = photoUrl(f.storage_path);
        });
        setFotosMap(map);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (notFoundState || !ctx) return <NotPublished />;

  return (
    <TenantSiteLayout ctx={ctx}>
      <TrackingPixels pixels={ctx.settings as any} />
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {hero.hero_titulo || `${ctx.tenantNome}`}
          </h1>
          {hero.hero_subtitulo && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {hero.hero_subtitulo}
            </p>
          )}
          <div className="mt-8">
            <a href="#imoveis">
              <Button size="lg">{hero.hero_cta_label || "Ver imóveis"}</Button>
            </a>
          </div>
        </div>
      </section>

      <section id="imoveis" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-6 text-2xl font-semibold">Imóveis em destaque</h2>
        {imoveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel publicado no momento.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {imoveis.map((i) => (
              <Link
                key={i.id}
                to="/imovel/$slug"
                params={{ slug: i.slug }}
                className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lg"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {fotosMap[i.id] ? (
                    <img
                      src={fotosMap[i.id]}
                      alt={i.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      sem foto
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">
                      {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
                    </Badge>
                  </div>
                  <h3 className="line-clamp-1 font-semibold">{i.titulo}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />{" "}
                    {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ") || "—"}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold">{formatBRL(i.preco)}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {i.quartos != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3 w-3" /> {i.quartos}
                        </span>
                      )}
                      {i.banheiros != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3 w-3" /> {i.banheiros}
                        </span>
                      )}
                      {i.area_util != null && (
                        <span className="flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" /> {i.area_util}m²
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {sobre && (
        <section id="sobre" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="mb-6 text-2xl font-semibold">Sobre nós</h2>
            <article
              className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: sobre }}
            />
          </div>
        </section>
      )}

      <ContactSection tenantSlug={ctx.tenantSlug} />
    </TenantSiteLayout>
  );
}

function ContactSection({ tenantSlug }: { tenantSlug: string }) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome");
    setSending(true);
    const { error } = await supabase.rpc("public_create_tenant_lead" as any, {
      _tenant_slug: tenantSlug,
      _nome: form.nome.trim(),
      _email: form.email || "",
      _telefone: form.telefone || "",
      _mensagem: form.mensagem || "",
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente o WhatsApp ou email do rodapé.");
      return;
    }
    toast.success("Mensagem enviada! Em breve entraremos em contato.");
    setForm({ nome: "", email: "", telefone: "", mensagem: "" });
  }

  return (
    <section id="contato" className="border-t border-border">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="mb-6 text-2xl font-semibold">Fale com a gente</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Telefone
              </Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Mensagem</Label>
            <Textarea
              rows={4}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function NotPublished() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-bold">Site indisponível</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Esta imobiliária ainda não publicou seu site público.
      </p>
      <Link to="/" className="text-sm text-primary hover:underline">
        ← Voltar ao início
      </Link>
    </div>
  );
}
