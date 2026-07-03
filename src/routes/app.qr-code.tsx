import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Building2,
  Landmark,
  FileText,
  Phone,
  Link2,
  MessageCircle,
  Download,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { waLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/app/qr-code")({
  component: QrCodePage,
});

type Fonte = "link" | "publicacao" | "telefone" | "whatsapp";
type PublicacaoTipo = "imovel" | "empreendimento" | "blog";

type ItemPublicavel = { id: string; titulo: string; slug: string };

type QrItem = {
  id: string;
  slug: string;
  target_url: string;
  label: string | null;
  clicks_count: number;
  utm_source: string | null;
  created_at: string;
};

const FONTE_INFO: Record<Fonte, { label: string; icon: typeof Link2; ajuda: string }> = {
  link: {
    label: "Link da internet",
    icon: Link2,
    ajuda: "Qualquer endereço da web — site próprio, portal parceiro, PDF, formulário, etc.",
  },
  publicacao: {
    label: "Publicação deste site",
    icon: Building2,
    ajuda:
      "Aponte direto para um imóvel, empreendimento ou artigo do blog já publicado no seu site.",
  },
  telefone: {
    label: "Ligação telefônica",
    icon: Phone,
    ajuda: "Ao escanear, o celular do cliente abre a tela de ligação já com o número discado.",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    ajuda: "Abre uma conversa de WhatsApp com o número e a mensagem que você definir.",
  },
};

function randomSlug() {
  return Math.random().toString(36).slice(2, 8);
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const PUBLICACAO_PATH: Record<PublicacaoTipo, string> = {
  imovel: "imovel",
  empreendimento: "empreendimento",
  blog: "blog",
};

async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

function QrCodePage() {
  const { tenantId, user } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();

  const [fonte, setFonte] = useState<Fonte>("publicacao");
  const [linkUrl, setLinkUrl] = useState("");
  const [publicacaoTipo, setPublicacaoTipo] = useState<PublicacaoTipo>("imovel");
  const [publicacaoId, setPublicacaoId] = useState("");
  const [itensPublicaveis, setItensPublicaveis] = useState<ItemPublicavel[]>([]);
  const [telefone, setTelefone] = useState("");
  const [whatsappMensagem, setWhatsappMensagem] = useState(
    "Olá! Vim através do QR Code e gostaria de mais informações.",
  );
  const [label, setLabel] = useState("");
  const [gerando, setGerando] = useState(false);

  const [ultimoQr, setUltimoQr] = useState<{ url: string; dataUrl: string; slug: string } | null>(
    null,
  );

  const [itens, setItens] = useState<QrItem[]>([]);
  const [loadingItens, setLoadingItens] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [previewAberto, setPreviewAberto] = useState<Record<string, string>>({});

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function carregarHistorico() {
    if (!tenantId) return;
    setLoadingItens(true);
    const { data } = await (supabase as any)
      .from("short_links")
      .select("id, slug, target_url, label, clicks_count, utm_source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItens((data as QrItem[]) ?? []);
    setLoadingItens(false);
  }

  useEffect(() => {
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (fonte !== "publicacao" || !tenantId) return;
    setPublicacaoId("");
    (async () => {
      if (publicacaoTipo === "imovel") {
        const { data } = await (supabase as any)
          .from("imoveis")
          .select("id, titulo, slug")
          .eq("tenant_id", tenantId)
          .eq("publicado", true)
          .order("titulo");
        setItensPublicaveis((data as ItemPublicavel[]) ?? []);
      } else if (publicacaoTipo === "empreendimento") {
        const { data } = await (supabase as any)
          .from("empreendimentos")
          .select("id, nome, slug")
          .eq("tenant_id", tenantId)
          .eq("publicado", true)
          .order("nome");
        setItensPublicaveis(
          ((data as any[]) ?? []).map((d) => ({ id: d.id, titulo: d.nome, slug: d.slug })),
        );
      } else {
        const { data } = await (supabase as any)
          .from("blog_posts")
          .select("id, titulo, slug")
          .eq("tenant_id", tenantId)
          .eq("status", "publicado")
          .order("titulo");
        setItensPublicaveis((data as ItemPublicavel[]) ?? []);
      }
    })();
  }, [fonte, publicacaoTipo, tenantId]);

  const itemSelecionado = itensPublicaveis.find((i) => i.id === publicacaoId);

  const targetUrl = useMemo(() => {
    if (fonte === "link") return linkUrl.trim();
    if (fonte === "publicacao" && itemSelecionado)
      return `${origin}/${PUBLICACAO_PATH[publicacaoTipo]}/${itemSelecionado.slug}`;
    if (fonte === "telefone") {
      const digits = telefone.replace(/\D/g, "");
      return digits ? `tel:+55${digits}` : "";
    }
    if (fonte === "whatsapp") {
      return waLink(telefone, whatsappMensagem) ?? "";
    }
    return "";
  }, [fonte, linkUrl, itemSelecionado, publicacaoTipo, telefone, whatsappMensagem, origin]);

  const labelSugerido = useMemo(() => {
    if (label) return label;
    if (fonte === "publicacao" && itemSelecionado) return itemSelecionado.titulo;
    if (fonte === "telefone" && telefone) return `Ligação — ${telefone}`;
    if (fonte === "whatsapp" && telefone) return `WhatsApp — ${telefone}`;
    if (fonte === "link" && linkUrl) return linkUrl;
    return "";
  }, [label, fonte, itemSelecionado, telefone, linkUrl]);

  const podeGerar =
    !!tenantId &&
    !!targetUrl &&
    (fonte !== "link" || /^https?:\/\//i.test(targetUrl)) &&
    (fonte !== "publicacao" || !!itemSelecionado) &&
    (fonte !== "telefone" || telefone.replace(/\D/g, "").length >= 10) &&
    (fonte !== "whatsapp" || telefone.replace(/\D/g, "").length >= 10);

  async function gerarQrCode() {
    if (!tenantId || !podeGerar) return;
    setGerando(true);
    const slug = randomSlug();
    const { error } = await (supabase as any).from("short_links").insert({
      tenant_id: tenantId,
      slug,
      target_url: targetUrl,
      label: labelSugerido || null,
      utm_source: fonte,
      utm_medium: "qrcode",
      imovel_id: fonte === "publicacao" && publicacaoTipo === "imovel" ? publicacaoId : null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      setGerando(false);
      return;
    }
    const shortUrl = `${origin}/l/${slug}`;
    const dataUrl = await qrDataUrl(shortUrl);
    setUltimoQr({ url: shortUrl, dataUrl, slug });
    toast.success("QR Code gerado!");
    setLabel("");
    setGerando(false);
    carregarHistorico();
  }

  function baixarPng(dataUrl: string, nomeArquivo: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = nomeArquivo;
    a.click();
  }

  async function alternarPreview(item: QrItem) {
    if (aberto === item.id) {
      setAberto(null);
      return;
    }
    setAberto(item.id);
    if (!previewAberto[item.id]) {
      const shortUrl = `${origin}/l/${item.slug}`;
      const dataUrl = await qrDataUrl(shortUrl);
      setPreviewAberto((s) => ({ ...s, [item.id]: dataUrl }));
    }
  }

  async function remover(id: string) {
    if (!(await confirmDialog("Remover este QR Code? Ele deixará de funcionar se já impresso.")))
      return;
    const { error } = await (supabase as any).from("short_links").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("QR Code removido");
    carregarHistorico();
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <QrCode className="h-7 w-7 text-primary" /> Gerador de QR Code
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie QR Codes prontos para colocar em placas, cartões, banners e anúncios — o cliente
          escaneia com a câmera do celular e cai direto no que você quiser: um imóvel, seu WhatsApp,
          um telefone ou qualquer link.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              1. Para onde o QR Code deve levar?
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FONTE_INFO) as Fonte[]).map((f) => {
                const Icon = FONTE_INFO[f].icon;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFonte(f)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                      fonte === f
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {FONTE_INFO[f].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {FONTE_INFO[fonte].ajuda}
            </p>
          </div>

          {fonte === "link" && (
            <div className="space-y-1.5">
              <Label htmlFor="qr-link">Endereço (URL) *</Label>
              <Input
                id="qr-link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemplo.com.br/pagina"
              />
              <span className="block text-[11px] text-muted-foreground">
                Cole o link completo, começando com https://
              </span>
            </div>
          )}

          {fonte === "publicacao" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tipo de publicação</Label>
                <Select
                  value={publicacaoTipo}
                  onValueChange={(v) => setPublicacaoTipo(v as PublicacaoTipo)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imovel">
                      <Building2 className="mr-1.5 inline h-3.5 w-3.5" /> Imóvel
                    </SelectItem>
                    <SelectItem value="empreendimento">
                      <Landmark className="mr-1.5 inline h-3.5 w-3.5" /> Empreendimento
                    </SelectItem>
                    <SelectItem value="blog">
                      <FileText className="mr-1.5 inline h-3.5 w-3.5" /> Artigo do blog
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Selecione a publicação *</Label>
                <Select value={publicacaoId} onValueChange={setPublicacaoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um item já publicado" />
                  </SelectTrigger>
                  <SelectContent>
                    {itensPublicaveis.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum item publicado encontrado.
                      </div>
                    )}
                    {itensPublicaveis.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="block text-[11px] text-muted-foreground">
                  Só aparecem itens já publicados no seu site — assim o QR nunca leva a uma página
                  fora do ar.
                </span>
              </div>
            </div>
          )}

          {(fonte === "telefone" || fonte === "whatsapp") && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="qr-telefone">Número (com DDD) *</Label>
                <Input
                  id="qr-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhoneInput(e.target.value))}
                  placeholder="(13) 99779-4382"
                  inputMode="numeric"
                />
              </div>
              {fonte === "whatsapp" && (
                <div className="space-y-1.5">
                  <Label htmlFor="qr-msg">Mensagem inicial</Label>
                  <Textarea
                    id="qr-msg"
                    value={whatsappMensagem}
                    onChange={(e) => setWhatsappMensagem(e.target.value)}
                    rows={3}
                  />
                  <span className="block text-[11px] text-muted-foreground">
                    Essa mensagem já vem digitada no WhatsApp do cliente — só falta ele apertar
                    enviar.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="qr-label">Nome interno deste QR Code (opcional)</Label>
            <Input
              id="qr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={labelSugerido || "Ex: Placa apto Jardins, Cartão de visita..."}
            />
            <span className="block text-[11px] text-muted-foreground">
              Só para você identificar depois na lista abaixo — o cliente nunca vê esse nome.
            </span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={gerarQrCode}
            disabled={!podeGerar || gerando}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {gerando ? "Gerando…" : "Gerar QR Code"}
          </Button>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-xl border border-border bg-card p-5 text-center">
            {ultimoQr ? (
              <>
                <img
                  src={ultimoQr.dataUrl}
                  alt="QR Code gerado"
                  className="mx-auto h-56 w-56 rounded-lg border border-border"
                />
                <code className="mt-3 block truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                  {ultimoQr.url}
                </code>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => baixarPng(ultimoQr.dataUrl, `qrcode-${ultimoQr.slug}.png`)}
                  >
                    <Download className="mr-2 h-4 w-4" /> Baixar PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(ultimoQr.url);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Pronto! Baixe a imagem e use em placas, cartões, banners, anúncios impressos ou
                  digitais. Cada leitura fica contada automaticamente na lista abaixo.
                </p>
              </>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-muted-foreground">
                <QrCode className="h-12 w-12 opacity-30" />
                <p className="text-xs">
                  Preencha o formulário ao lado e clique em "Gerar QR Code" para ver o resultado
                  aqui.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">QR Codes já gerados</h2>
        {loadingItens ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Você ainda não gerou nenhum QR Code. Use o formulário acima para criar o primeiro.
          </div>
        ) : (
          <div className="grid gap-3">
            {itens.map((item) => {
              const fonteKey = (item.utm_source as Fonte) || "link";
              const Icon = FONTE_INFO[fonteKey]?.icon ?? Link2;
              const shortUrl = `${origin}/l/${item.slug}`;
              return (
                <div key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{item.label ?? item.slug}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.clicks_count} {item.clicks_count === 1 ? "leitura" : "leituras"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                          {shortUrl}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(shortUrl);
                            setCopiado(item.id);
                            toast.success("Link copiado");
                            setTimeout(() => setCopiado(null), 1500);
                          }}
                        >
                          {copiado === item.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => alternarPreview(item)}>
                          {aberto === item.id ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remover(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        → {item.target_url}
                      </div>
                    </div>
                    {aberto === item.id && previewAberto[item.id] && (
                      <div className="shrink-0 text-center">
                        <img
                          src={previewAberto[item.id]}
                          alt="QR Code"
                          className="h-28 w-28 rounded border border-border"
                        />
                        <Button
                          size="sm"
                          variant="link"
                          className="mt-1 h-auto p-0 text-[11px]"
                          onClick={() =>
                            baixarPng(previewAberto[item.id], `qrcode-${item.slug}.png`)
                          }
                        >
                          Baixar PNG
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog />
    </div>
  );
}
