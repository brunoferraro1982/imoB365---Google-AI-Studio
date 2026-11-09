/**
 * Fonte única da navegação do /app e do /admin: módulos do tenant (com guarda
 * de papel/plano feita no AppShell), grupos do super-admin e utilitários de
 * ativo/rótulo usados pelo trilho, pelo submenu e pela barra inferior.
 */
import {
  Radar,
  Palette,
  Share2,
  Clock,
  MessageCircle,
  Building2,
  Users,
  UserCircle2,
  FileText,
  Banknote,
  Wallet,
  Globe2,
  Settings,
  Mail,
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  Globe,
  Calendar,
  Landmark,
  Building,
  Home,
  CheckSquare,
  Scale,
  Megaphone,
  FileSignature,
  Link2,
  QrCode,
  Flag,
  Gauge,
  Sparkles,
  GraduationCap,
  BookOpen,
  PlayCircle,
  Library,
  LayoutGrid,
  HeartHandshake,
  Upload,
  Receipt,
  Eye,
  CreditCard,
  Target,
  Activity,
  PenTool,
  Headset,
  Factory,
  GalleryHorizontalEnd,
  Route,
  IdCard,
  Briefcase,
  Search,
  type LucideIcon,
} from "lucide-react";
import { canAccessModule, isModuleEnabled, type AppModule } from "@/lib/permissions";
import type { AppRole } from "@/hooks/useAuth";

export type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Item só aparece se o plano incluir este módulo. */
  requiredModule?: AppModule;
};
export type Module = {
  id: string;
  label: string;
  /** Rótulo curto para trilho e barra inferior (cabe em ~84px). */
  curto: string;
  icon: LucideIcon;
  items: Item[];
  requiredModule?: AppModule;
  /** Destaque visual no trilho (ex.: chat, principal canal do corretor). */
  destaque?: boolean;
};

export const tenantModules: Module[] = [
  {
    id: "atendimento",
    label: "Atendimento",
    curto: "Atendimento",
    icon: Headset,
    destaque: true,
    items: [
      { to: "/app/atendimento", label: "Painel", icon: LayoutDashboard },
      { to: "/app/chat", label: "Conversas", icon: MessageCircle },
      {
        to: "/app/atendimento/chamados",
        label: "Chamados",
        icon: Headset,
        requiredModule: "atendimento" as AppModule,
      },
      {
        to: "/app/configuracoes/atendimento-sla",
        label: "SLA e canais",
        icon: Clock,
        requiredModule: "atendimento" as AppModule,
      },
    ],
  },
  {
    id: "dashboard",
    label: "Início",
    curto: "Início",
    icon: LayoutDashboard,
    items: [
      { to: "/app", label: "Painel de gestão", icon: LayoutDashboard },
      { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    id: "imobiliario",
    label: "Imobiliário",
    curto: "Imóveis",
    icon: Building,
    items: [
      { to: "/app/imoveis", label: "Publicar Imóveis", icon: Building2 },
      { to: "/app/locacao", label: "Locação", icon: Home },
      { to: "/app/imoveis/importar", label: "Importar imóveis", icon: Upload },
      { to: "/app/empreendimentos", label: "Empreendimentos", icon: Building },
      { to: "/app/leads", label: "Leads", icon: Users },
      { to: "/app/leads/analise-risco", label: "Análise de Risco", icon: ShieldCheck },
      { to: "/app/leads/captacao", label: "Captação Automática", icon: Radar },
      { to: "/app/parceiros-comerciais", label: "Parceiros Comerciais", icon: Briefcase },
      { to: "/app/tarefas", label: "Minhas tarefas", icon: CheckSquare },
      { to: "/app/visitas", label: "Agenda de visitas", icon: Calendar },
      { to: "/app/roteiro-visitas", label: "Roteiro de Visitas", icon: Route },
      { to: "/app/cartao-virtual", label: "Cartão Virtual", icon: IdCard },
    ],
  },
  {
    id: "elearning",
    requiredModule: "elearning" as AppModule,
    label: "E-Learning",
    curto: "Cursos",
    icon: GraduationCap,
    items: [
      { to: "/app/elearning", label: "Meus cursos", icon: BookOpen },
      { to: "/app/elearning/admin", label: "Gerenciar cursos", icon: PlayCircle },
    ],
  },
  {
    id: "juridico",
    requiredModule: "juridico" as AppModule,
    label: "Jurídico",
    curto: "Jurídico",
    icon: Scale,
    items: [
      { to: "/app/contratos/painel", label: "Painel", icon: LayoutDashboard },
      { to: "/app/contratos", label: "Contratos", icon: FileText },
      { to: "/app/contratos/modelos", label: "Modelos de contrato", icon: FileSignature },
      { to: "/app/contratos/modelos/biblioteca", label: "Biblioteca de modelos", icon: Library },
      { to: "/app/contratos/checklist", label: "Checklists", icon: CheckSquare },
      { to: "/app/cartorios", label: "Cartórios", icon: Landmark },
    ],
  },
  {
    id: "financeiro",
    requiredModule: "financeiro" as AppModule,
    label: "Financeiro",
    curto: "Financeiro",
    icon: Banknote,
    items: [
      { to: "/app/financeiro/dashboard", label: "Dashboard executivo", icon: BarChart3 },
      { to: "/app/financeiro", label: "Contas a pagar e receber", icon: Banknote },
      { to: "/app/comissoes", label: "Comissões", icon: Wallet },
      { to: "/app/locacao/repasses", label: "Repasses (locação)", icon: Landmark },
      { to: "/app/locacao/prestacao-contas", label: "Prestação de contas", icon: FileText },
      { to: "/app/financeiro/plano-contas", label: "Plano de contas", icon: FileText },
      { to: "/app/financeiro/centros-custo", label: "Centros de custo", icon: Building },
    ],
  },
  {
    id: "site",
    requiredModule: "marketing" as AppModule,
    label: "Site",
    curto: "Site",
    icon: Globe,
    items: [
      { to: "/app/site/previa", label: "Prévia do Site", icon: Eye },
      { to: "/app/site", label: "Site da imobiliária", icon: Globe },
      { to: "/app/site/widgets-conteudo", label: "Widgets de Conteúdo", icon: LayoutGrid },
      { to: "/app/site/blog", label: "Blog & Artigos", icon: FileText },
      { to: "/app/qr-code", label: "Gerador de QR Code", icon: QrCode },
    ],
  },
  {
    id: "marketing",
    requiredModule: "marketing" as AppModule,
    label: "Marketing",
    curto: "Marketing",
    icon: Megaphone,
    items: [
      { to: "/app/portais/meta", label: "Redes sociais", icon: Share2 },
      { to: "/app/portais/canva", label: "Canva", icon: Palette },
      { to: "/app/marketing/google-ads", label: "Google Ads", icon: Target },
      { to: "/app/parcerias", label: "Parcerias", icon: HeartHandshake },
    ],
  },
  {
    id: "ajustes",
    label: "Configurações",
    curto: "Config",
    icon: Settings,
    items: [
      { to: "/app/configuracoes", label: "Visão geral", icon: LayoutDashboard },
      { to: "/app/configuracoes/equipe", label: "Equipe", icon: Users },
      { to: "/app/configuracoes/funis", label: "Funis", icon: BarChart3 },
      { to: "/app/configuracoes/scoring", label: "Lead scoring", icon: Gauge },
      { to: "/app/configuracoes/cadencias", label: "Cadências", icon: Calendar },
      {
        to: "/app/configuracoes/integracoes-bancarias",
        label: "Integrações Bancárias",
        icon: CreditCard,
      },
      {
        to: "/app/configuracoes/conciliacao-bancaria",
        label: "Conciliação Bancária",
        icon: Landmark,
      },
      {
        to: "/app/configuracoes/assinatura-eletronica",
        label: "Assinatura eletrônica",
        icon: PenTool,
      },
      {
        to: "/app/configuracoes/nota-fiscal",
        label: "Nota Fiscal",
        icon: Receipt,
      },
      {
        to: "/app/configuracoes/atendimento-canais",
        label: "Canais de Atendimento",
        icon: Headset,
      },
      {
        to: "/app/configuracoes/atendimento-sla",
        label: "SLA de Atendimento",
        icon: Headset,
      },
      { to: "/app/contratacao", label: "Plano & Contratação", icon: Banknote },
      { to: "/app/configuracoes/campos", label: "Campos personalizados", icon: FileText },
      { to: "/app/configuracoes/webhooks", label: "Webhooks", icon: Link2 },
      { to: "/app/configuracoes/api", label: "API", icon: FileSignature },
      { to: "/app/configuracoes/notificacoes", label: "Notificações", icon: Mail },
      { to: "/app/configuracoes/golive", label: "Go-live", icon: Sparkles },
      { to: "/app/configuracoes/seguranca", label: "Segurança", icon: ShieldCheck },
      { to: "/app/configuracoes/privacidade", label: "Privacidade (LGPD)", icon: ShieldCheck },
    ],
  },
];

export const adminNav: Item[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { to: "/admin/tenants", label: "Imobiliárias", icon: Building2 },
  { to: "/admin/construtoras", label: "Construtoras", icon: Factory },
  { to: "/admin/importar-imoveis", label: "Assistente de importação", icon: Sparkles },
  { to: "/admin/vitrine-parceiros", label: "Vitrine de Parceiros", icon: GalleryHorizontalEnd },
  { to: "/admin/google-ads", label: "Google Ads", icon: Target },
  { to: "/admin/atendimento", label: "Central de Atendimento", icon: Headset },
  { to: "/admin/atendimento/painel", label: "Painel de Atendimento", icon: BarChart3 },
  { to: "/admin/faturamento", label: "Faturamento", icon: Receipt },
  { to: "/admin/blog", label: "Blog corporativo", icon: FileText },
  { to: "/admin/planos", label: "Planos", icon: Banknote },
  { to: "/admin/limites", label: "Limites por plano", icon: Gauge },
  { to: "/admin/modulos", label: "Módulos", icon: Globe2 },
  { to: "/admin/flags", label: "Feature flags", icon: Flag },
  { to: "/admin/integracoes", label: "Integrações", icon: Settings },
  { to: "/admin/emails", label: "E-mails", icon: Mail },
  { to: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
  { to: "/admin/seo", label: "SEO & Search Console", icon: Search },
  { to: "/admin/status", label: "Status & Infraestrutura", icon: Activity },
];

/** Grupos do super-admin: o trilho mostra o grupo e o submenu, os itens. */
export type AdminGroup = {
  id: string;
  label: string;
  curto: string;
  icon: LucideIcon;
  items: Item[];
};
const ADMIN_BY_TO = Object.fromEntries(adminNav.map((i) => [i.to, i])) as Record<string, Item>;
const pick = (...tos: string[]) => tos.map((t) => ADMIN_BY_TO[t]);
export const adminGroups: AdminGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    curto: "Operação",
    icon: Building2,
    items: pick(
      "/admin",
      "/admin/tenants",
      "/admin/construtoras",
      "/admin/importar-imoveis",
      "/admin/vitrine-parceiros",
    ),
  },
  {
    id: "atendimento",
    label: "Atendimento",
    curto: "Atend.",
    icon: Headset,
    items: pick("/admin/atendimento", "/admin/atendimento/painel", "/admin/faturamento"),
  },
  {
    id: "conteudo",
    label: "Conteúdo e marketing",
    curto: "Conteúdo",
    icon: Megaphone,
    items: pick("/admin/blog", "/admin/seo", "/admin/google-ads"),
  },
  {
    id: "planos",
    label: "Planos e módulos",
    curto: "Planos",
    icon: Banknote,
    items: pick("/admin/planos", "/admin/limites", "/admin/modulos", "/admin/flags"),
  },
  {
    id: "sistema",
    label: "Sistema",
    curto: "Sistema",
    icon: ShieldCheck,
    items: pick("/admin/integracoes", "/admin/emails", "/admin/auditoria", "/admin/status"),
  },
];

/**
 * Item ativo: o mais específico (maior prefixo) entre irmãos. "/app" só casa
 * exatamente. Mesma regra que o aside original, agora em um único lugar.
 */
export function isItemActive(item: Item, items: Item[], current: string): boolean {
  if (item.to === "/app" || item.to === "/admin") return current === item.to;
  return (
    current === item.to ||
    (current.startsWith(item.to + "/") &&
      !items.some(
        (s) =>
          s.to !== item.to &&
          s.to !== "/app" &&
          current.startsWith(s.to) &&
          s.to.length > item.to.length,
      ))
  );
}

/** Módulo (ou grupo) cujo item casa com o caminho atual — o mais específico vence. */
export function activeSection<T extends { items: Item[] }>(
  sections: T[],
  current: string,
): T | undefined {
  let best: T | undefined;
  let len = -1;
  for (const s of sections)
    for (const it of s.items) {
      const matches =
        it.to === "/app" || it.to === "/admin"
          ? current === it.to
          : current === it.to || current.startsWith(it.to + "/");
      if (matches && it.to.length > len) {
        best = s;
        len = it.to.length;
      }
    }
  return best;
}

/**
 * Módulos que o usuário enxerga: papel (Guard 1) e plano (Guard 2).
 * Super admins veem todos. Usado pelo trilho e pelo painel inicial.
 */
export function modulosVisiveis({
  roles,
  enabledModules,
  isSuperAdmin,
}: {
  roles: AppRole[];
  enabledModules: AppModule[];
  isSuperAdmin: boolean;
}): Module[] {
  const podeVer = (mod?: AppModule) =>
    isSuperAdmin || !mod || (canAccessModule(roles, mod) && isModuleEnabled(enabledModules, mod));
  return tenantModules
    .filter((m) => podeVer(m.requiredModule))
    .map((m) => ({ ...m, items: m.items.filter((it) => podeVer(it.requiredModule)) }))
    .filter((m) => m.items.length > 0);
}
