import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Mail,
  MessageCircle,
  Palette,
  PenTool,
  Receipt,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getMercadoPagoConnectionStatus } from "@/lib/mercadopagoOAuth.functions";
import { getDocusignConnectionStatus } from "@/lib/docusignOAuth.functions";
import { getMetaConnectionStatus } from "@/lib/metaOAuth.functions";
import { getCanvaConnectionStatus } from "@/lib/canvaOAuth.functions";
import { getNfeConfigStatus } from "@/lib/nfeFocusNfe.functions";
import { obterConfigAsaas } from "@/lib/asaas.functions";
import { obterWhatsAppEvolution } from "@/lib/whatsappEvolution.functions";
import { getTenantSmtpConfig } from "@/lib/tenantSmtp.functions";

export const Route = createFileRoute("/app/configuracoes/integracoes/")({
  head: () => ({ meta: [{ title: "Integrações — imob365" }] }),
  component: IntegracoesHubPage,
});

type CardState = "conectado" | "nao_configurado" | "erro" | "verificando";

type CardStatus = {
  state: CardState;
  detalhe?: string;
};

type IntegracaoCardProps = {
  nome: string;
  descricao: string;
  icon: LucideIcon;
  to: string;
  status: CardStatus;
};

const STATUS_VISUAL: Record<CardState, { label: string; className: string }> = {
  conectado: { label: "Conectado", className: "text-emerald-600" },
  nao_configurado: { label: "Não configurado", className: "text-muted-foreground" },
  erro: { label: "Erro", className: "text-destructive" },
  verificando: { label: "Verificando…", className: "text-muted-foreground" },
};

// Status derivado de uma query (mesma queryKey das páginas de origem, para
// reaproveitar o cache). Se a consulta falhar, mostra "erro" — nunca inventa
// um estado conectado/desconectado.
function statusFromQuery<T>(query: UseQueryResult<T>, derive: (data: T) => CardStatus): CardStatus {
  if (query.isPending) return { state: "verificando" };
  if (query.isError) return { state: "erro", detalhe: "Não foi possível verificar agora" };
  if (query.data === undefined) return { state: "nao_configurado" };
  return derive(query.data);
}

function IntegracoesHubPage() {
  const { isAdmin } = useAuth();

  const fetchMp = useServerFn(getMercadoPagoConnectionStatus);
  const fetchDocusign = useServerFn(getDocusignConnectionStatus);
  const fetchMeta = useServerFn(getMetaConnectionStatus);
  const fetchCanva = useServerFn(getCanvaConnectionStatus);
  const fetchNfe = useServerFn(getNfeConfigStatus);
  const fetchAsaas = useServerFn(obterConfigAsaas);
  const fetchWhatsApp = useServerFn(obterWhatsAppEvolution);
  const fetchSmtp = useServerFn(getTenantSmtpConfig);

  const mpQuery = useQuery({
    queryKey: ["mercadopago-connection-status"],
    queryFn: () => fetchMp(),
  });
  const docusignQuery = useQuery({
    queryKey: ["docusign-connection-status"],
    queryFn: () => fetchDocusign(),
  });
  const metaQuery = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => fetchMeta(),
  });
  const canvaQuery = useQuery({
    queryKey: ["canva-connection-status"],
    queryFn: () => fetchCanva(),
  });
  // A consulta de NFe só é permitida a administradores/financeiro no servidor;
  // para os demais não disparamos a chamada.
  const nfeQuery = useQuery({
    queryKey: ["nfe-config-status"],
    queryFn: () => fetchNfe(),
    enabled: isAdmin,
  });

  const asaasQuery = useQuery({
    queryKey: ["asaas-config-view"],
    queryFn: () => fetchAsaas(),
    enabled: isAdmin,
  });
  const whatsappQuery = useQuery({
    queryKey: ["whatsapp-evolution-config"],
    queryFn: () => fetchWhatsApp(),
    enabled: isAdmin,
  });
  const smtpQuery = useQuery({
    queryKey: ["tenant-smtp-config"],
    queryFn: () => fetchSmtp(),
    enabled: isAdmin,
  });

  const cards: IntegracaoCardProps[] = [
    {
      nome: "Mercado Pago",
      descricao: "PIX, boleto e cartão pro cliente final da imobiliária.",
      icon: CreditCard,
      to: "/app/configuracoes/integracoes-bancarias/mercadopago",
      status: statusFromQuery(mpQuery, (d) =>
        d.connected ? { state: "conectado" } : { state: "nao_configurado" },
      ),
    },
    {
      nome: "Asaas",
      descricao: "Cobrança e boletos via Asaas.",
      icon: Wallet,
      to: "/app/configuracoes/integracoes/asaas",
      status: !isAdmin
        ? { state: "nao_configurado", detalhe: "Visível apenas para administradores" }
        : statusFromQuery(asaasQuery, (d) =>
            d.existe && d.ativo
              ? { state: "conectado", detalhe: d.ambiente }
              : { state: "nao_configurado" },
          ),
    },
    {
      nome: "WhatsApp (Evolution API)",
      descricao: "Envio de mensagens e atendimento pelo WhatsApp.",
      icon: MessageCircle,
      to: "/app/configuracoes/integracoes/whatsapp",
      status: !isAdmin
        ? { state: "nao_configurado", detalhe: "Visível apenas para administradores" }
        : statusFromQuery(whatsappQuery, (d) =>
            d.configurado && d.ativo ? { state: "conectado" } : { state: "nao_configurado" },
          ),
    },
    {
      nome: "E-mail (SMTP)",
      descricao: "Servidor próprio para envio de e-mails da imobiliária.",
      icon: Mail,
      to: "/app/configuracoes/integracoes/email",
      status: !isAdmin
        ? { state: "nao_configurado", detalhe: "Visível apenas para administradores" }
        : statusFromQuery(smtpQuery, (d) =>
            d.configurado && d.ativo ? { state: "conectado" } : { state: "nao_configurado" },
          ),
    },
    {
      nome: "Meta (Facebook e Instagram)",
      descricao: "Publicação de imóveis e leads de Página e Instagram.",
      icon: Share2,
      to: "/app/portais/meta",
      status: statusFromQuery(metaQuery, (d) =>
        d.connected
          ? {
              state: "conectado",
              detalhe: d.instagramConnected
                ? `Página ${d.pageName} + Instagram`
                : `Página ${d.pageName}`,
            }
          : { state: "nao_configurado" },
      ),
    },
    {
      nome: "Canva",
      descricao: "Edição de artes de imóveis direto no Canva.",
      icon: Palette,
      to: "/app/portais/canva",
      status: statusFromQuery(canvaQuery, (d) =>
        d.connected ? { state: "conectado" } : { state: "nao_configurado" },
      ),
    },
    {
      nome: "Assinatura eletrônica (DocuSign)",
      descricao: "Envio de contratos para assinatura eletrônica.",
      icon: PenTool,
      to: "/app/configuracoes/assinatura-eletronica",
      status: statusFromQuery(docusignQuery, (d) =>
        d.connected
          ? { state: "conectado", detalhe: d.accountName ?? undefined }
          : { state: "nao_configurado" },
      ),
    },
    {
      nome: "Nota fiscal (Focus NFe)",
      descricao: "Emissão de NFS-e de serviço.",
      icon: Receipt,
      to: "/app/configuracoes/nota-fiscal",
      status: !isAdmin
        ? { state: "nao_configurado", detalhe: "Visível apenas para administradores" }
        : statusFromQuery(nfeQuery, (d) =>
            d.configured && d.ativo
              ? {
                  state: "conectado",
                  detalhe: d.ambiente === "producao" ? "Produção" : "Homologação",
                }
              : {
                  state: "nao_configurado",
                  detalhe: d.configured ? "Configurada, mas desativada" : undefined,
                },
          ),
    },
  ];

  return (
    <div className="p-8">
      <Link
        to="/app/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as conexões da sua conta com serviços externos num só lugar. Escolha uma integração
          para configurar ou revisar.
        </p>
      </header>

      <div className="grid max-w-3xl gap-3">
        {cards.map((card) => (
          <IntegracaoCard key={card.nome} {...card} />
        ))}
      </div>
    </div>
  );
}

function IntegracaoCard({ nome, descricao, icon: Icon, to, status }: IntegracaoCardProps) {
  const visual = STATUS_VISUAL[status.state];
  const StatusIcon =
    status.state === "conectado" ? CheckCircle2 : status.state === "erro" ? CircleAlert : null;

  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">{nome}</p>
          <p className="text-sm text-muted-foreground">{descricao}</p>
          {status.detalhe && <p className="mt-1 text-xs text-muted-foreground">{status.detalhe}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1 whitespace-nowrap text-xs font-medium ${visual.className}`}
        >
          {StatusIcon && <StatusIcon className="h-4 w-4" />}
          {visual.label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
