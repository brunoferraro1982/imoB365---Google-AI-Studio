import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Bed, Bath, Car, Maximize2, MapPin, Home, MessageCircle, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { waLink, imovelMessage } from "@/lib/whatsapp";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrackingPixels } from "@/components/site/TrackingPixels";
import { useServerFn } from "@tanstack/react-start";
import { startConversationFromImovel } from "@/lib/chat.functions";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { FavoritoButton } from "@/components/FavoritoButton";
import { CompararCheckbox } from "@/components/CompararSelector";
import { SimuladorFinanciamento } from "@/components/imovel/SimuladorFinanciamento";
import { HistoricoPreco } from "@/components/imovel/HistoricoPreco";
import { ImoveisSimilares } from "@/components/imovel/ImoveisSimilares";
import { AgendarVisita } from "@/components/imovel/AgendarVisita";

export const Route = createFileRoute("/imovel/$slug")({
  component: ImovelDetail,
});

type Imovel = {
  id: string;
  titulo: string;
  descricao: string | null;
  finalidade: string;
  tipo: string;
  preco: number;
  condominio: number | null;
  iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  mostrar_endereco_publico: boolean;
  tenant_id: string;
  corretor_responsavel_id: string | null;
};

function ImovelDetail() {
  const { slug } = Route.useParams();
  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [fotos, setFotos] = useState<{ storage_path: string; capa: boolean }[]>([]);
  const [tenantNome, setTenantNome] = useState<string>("");
  const [pixels, setPixels] = useState<any>(null);
  const [corretor, setCorretor] = useState<{
    nome: string;
    whatsapp: string | null;
    slug: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("*")
        .eq("slug", slug)
        .eq("publicado", true)
        .eq("status", "ativo")
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      setImovel(data as unknown as Imovel);
      const [{ data: fotosData }, { data: tenant }, { data: cor }, { data: site }] =
        await Promise.all([
          supabase
            .from("imovel_fotos")
            .select("storage_path,capa")
            .eq("imovel_id", data.id)
            .order("capa", { ascending: false })
            .order("ordem"),
          supabase.from("tenants").select("nome").eq("id", data.tenant_id).maybeSingle(),
          data.corretor_responsavel_id
            ? (supabase as any)
                .from("corretores")
                .select("nome,whatsapp,slug")
                .eq("id", data.corretor_responsavel_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          (supabase as any)
            .from("tenant_site_settings")
            .select("ga4_id,gtm_id,fb_pixel_id,google_ads_id,hotjar_id,head_custom_html")
            .eq("tenant_id", data.tenant_id)
            .maybeSingle(),
        ]);
      setFotos(fotosData ?? []);
      setTenantNome(tenant?.nome ?? "");
      setCorretor(cor ?? null);
      setPixels(site ?? null);
      setLoading(false);
    })();
  }, [slug]);

  function publicUrl(path: string) {
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
  }

  if (loading)
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!imovel)
    return (
      <div className="p-16 text-center">
        <h1 className="text-2xl font-bold">Imóvel não encontrado</h1>
        <Link to="/buscar" className="mt-4 inline-block text-primary hover:underline">
          Voltar para a busca
        </Link>
      </div>
    );

  const enderecoLinha = [
    imovel.mostrar_endereco_publico
      ? `${imovel.endereco_logradouro ?? ""}${imovel.endereco_numero ? ", " + imovel.endereco_numero : ""}`
      : null,
    imovel.endereco_bairro,
    [imovel.endereco_cidade, imovel.endereco_uf].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-background">
      <TrackingPixels pixels={pixels} />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {fotos.length > 0 && (
          <div className="mb-8 grid gap-2 overflow-hidden rounded-xl md:grid-cols-4 md:grid-rows-2">
            <img
              src={publicUrl(fotos[0].storage_path)}
              alt=""
              className="h-72 w-full object-cover md:col-span-2 md:row-span-2 md:h-full"
            />
            {fotos.slice(1, 5).map((f, i) => (
              <img
                key={i}
                src={publicUrl(f.storage_path)}
                alt=""
                className="h-36 w-full object-cover"
              />
            ))}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {FINALIDADE_LABEL[imovel.finalidade]}
              </span>
              <span>{TIPO_LABEL[imovel.tipo]}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{imovel.titulo}</h1>
            {enderecoLinha && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {enderecoLinha}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FavoritoButton imovelId={imovel.id} size="md" />
              <CompararCheckbox imovelId={imovel.id} />
              <button
                type="button"
                onClick={async () => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: imovel.titulo, url });
                    } catch {}
                  } else {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs hover:bg-background"
              >
                <Share2 className="h-3.5 w-3.5" /> Compartilhar
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 border-y border-border py-4 text-sm">
              {imovel.quartos != null && <Spec icon={Bed} label={`${imovel.quartos} quartos`} />}
              {imovel.banheiros != null && (
                <Spec icon={Bath} label={`${imovel.banheiros} banheiros`} />
              )}
              {imovel.vagas != null && <Spec icon={Car} label={`${imovel.vagas} vagas`} />}
              {imovel.area_util != null && (
                <Spec icon={Maximize2} label={`${imovel.area_util} m² úteis`} />
              )}
              {imovel.area_total != null && (
                <Spec icon={Home} label={`${imovel.area_total} m² totais`} />
              )}
            </div>

            {imovel.descricao && (
              <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-foreground/90">
                {imovel.descricao}
              </div>
            )}

            {imovel.finalidade === "venda" && <SimuladorFinanciamento preco={imovel.preco} />}
            <HistoricoPreco imovelId={imovel.id} precoAtual={imovel.preco} />
          </div>

          <aside className="h-fit rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              {FINALIDADE_LABEL[imovel.finalidade]} por
            </p>
            <p className="mt-1 text-3xl font-bold text-primary">{formatBRL(imovel.preco)}</p>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {imovel.condominio != null && <li>Condomínio: {formatBRL(imovel.condominio)}</li>}
              {imovel.iptu != null && <li>IPTU: {formatBRL(imovel.iptu)}</li>}
            </ul>
            <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              Anunciado por <span className="font-medium text-foreground">{tenantNome}</span>
            </div>
            {corretor?.whatsapp &&
              (() => {
                const url = typeof window !== "undefined" ? window.location.href : undefined;
                const link = waLink(
                  corretor.whatsapp,
                  imovelMessage({ titulo: imovel.titulo, url }),
                );
                return link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> Falar com {corretor.nome.split(" ")[0]} no
                    WhatsApp
                  </a>
                ) : null;
              })()}
            <StartChatButton
              imovelId={imovel.id}
              titulo={imovel.titulo}
              tenantId={imovel.tenant_id}
            />
            <AgendarVisita imovelId={imovel.id} titulo={imovel.titulo} />
            <LeadForm imovelId={imovel.id} titulo={imovel.titulo} />
          </aside>
        </div>

        <ImoveisSimilares
          imovelId={imovel.id}
          tipo={imovel.tipo}
          finalidade={imovel.finalidade}
          preco={imovel.preco}
          cidade={imovel.endereco_cidade}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

function StartChatButton({
  imovelId,
  titulo,
  tenantId,
}: {
  imovelId: string;
  titulo: string;
  tenantId: string;
}) {
  const navigate = useNavigate();
  const startFn = useServerFn(startConversationFromImovel);
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", u.user.id)
        .eq("tenant_id", tenantId)
        .limit(1);
      setIsMember((roles ?? []).length > 0);
    })();
  }, [tenantId]);

  if (isMember) return null;

  async function onClick() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const redir = typeof window !== "undefined" ? window.location.pathname : "/";
      navigate({ to: "/login", search: { redirect: redir } as any });
      return;
    }
    setSending(true);
    try {
      const res = await startFn({
        data: {
          imovelId,
          firstMessage: `Olá, tenho interesse no imóvel "${titulo}". Pode me passar mais informações?`,
        },
      });
      navigate({ to: "/conta/chat/$id", params: { id: res.id } });
    } catch (e: any) {
      const msg = e?.message || e?.toString?.() || "Não foi possível iniciar a conversa";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={sending}
      className="mt-3 w-full"
      variant="outline"
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      {sending ? "Abrindo conversa…" : "Conversar com o anunciante"}
    </Button>
  );
}

function Spec({ icon: Icon, label }: { icon: typeof Bed; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-foreground/80">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </div>
  );
}

function LeadForm({ imovelId, titulo }: { imovelId: string; titulo: string }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState(
    `Olá, tenho interesse no imóvel "${titulo}". Pode me enviar mais informações?`,
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe seu nome");
    if (!email.trim() && !telefone.trim()) return toast.error("Informe e-mail ou telefone");
    setSending(true);
    const { error } = await (supabase as any).rpc("public_create_lead", {
      _imovel_id: imovelId,
      _nome: nome.trim().slice(0, 200),
      _email: email.trim().slice(0, 255),
      _telefone: telefone.trim().slice(0, 40),
      _mensagem: mensagem.trim().slice(0, 2000),
    });
    setSending(false);
    if (error) return toast.error("Não foi possível enviar: " + error.message);
    setSent(true);
    toast.success("Mensagem enviada! Um corretor entrará em contato.");
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
        Recebemos seu contato. Em instantes um corretor responsável vai te procurar.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold">Falar com um corretor</h3>
      <div>
        <Label className="text-xs">Nome *</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} />
      </div>
      <div>
        <Label className="text-xs">E-mail</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
        />
      </div>
      <div>
        <Label className="text-xs">Telefone / WhatsApp</Label>
        <Input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          maxLength={40}
          placeholder="(11) 99999-9999"
        />
      </div>
      <div>
        <Label className="text-xs">Mensagem</Label>
        <Textarea
          rows={3}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={2000}
        />
      </div>
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Enviando…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
