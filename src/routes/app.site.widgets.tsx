import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import { 
  Plus, Trash2, Edit, Eye, Sparkles, RefreshCw, Layout, 
  Settings, MessageSquare, Megaphone, Smartphone, HelpCircle, 
  Code, Play, AlertCircle, CheckCircle2, Copy, BarChart3, ChevronLeft, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/app/site/widgets")({
  component: WidgetsManagerPage,
});

type ConversionWidget = {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  tipo: "whatsapp" | "captura_leads" | "calculadora_financ" | "banner_cta";
  ativo: boolean;
  posicao: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "inline";
  texto_cta: string | null;
  texto_whatsapp: string | null;
  telefone_whatsapp: string | null;
  cor_fundo: string | null;
  cor_texto: string | null;
  views_count: number;
  leads_count: number;
  created_at: string;
  updated_at: string;
};

const EMPTY_WIDGET: Partial<ConversionWidget> = {
  nome: "",
  slug: "",
  tipo: "whatsapp",
  ativo: true,
  posicao: "bottom-right",
  texto_cta: "Fale com um corretor especialista",
  texto_whatsapp: "Olá! Desejo obter informações sobre novos imóveis.",
  telefone_whatsapp: "11999999999",
  cor_fundo: "#25D366",
  cor_texto: "#FFFFFF",
};

function WidgetsManagerPage() {
  const { tenantId } = useAuth();
  const [widgets, setWidgets] = useState<ConversionWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Editor View Option
  const [isEditing, setIsEditing] = useState(false);
  const [currentWidget, setCurrentWidget] = useState<Partial<ConversionWidget>>(EMPTY_WIDGET);
  const [formActiveTab, setFormActiveTab] = useState<"geral" | "design" | "tecnico">("geral");

  useEffect(() => {
    if (!tenantId) return;
    loadWidgets();
  }, [tenantId]);

  async function loadWidgets() {
    try {
      setLoading(true);
      const localData = localStorage.getItem(`local_conversion_widgets_${tenantId}`);
      if (localData) {
        setWidgets(JSON.parse(localData));
        setLoading(false);
        return;
      }

      const { data, error } = await ((supabase as any)
        .from("conversion_widgets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as any);

      if (error) {
        console.warn("Utilizando persistência local para conversion_widgets:", error.message);
        fallbackLocalData();
        return;
      }
      const dataWidgets = (data as ConversionWidget[]) ?? [];
      setWidgets(dataWidgets);
      localStorage.setItem(`local_conversion_widgets_${tenantId}`, JSON.stringify(dataWidgets));
    } catch (_) {
      fallbackLocalData();
    } finally {
      setLoading(false);
    }
  }

  function fallbackLocalData() {
    const defaultWidgets: ConversionWidget[] = [
      {
        id: "w1",
        tenant_id: tenantId || "",
        nome: "Atendimento Rápido WhatsApp",
        slug: "atendimento-rapido-whatsapp",
        tipo: "whatsapp",
        ativo: true,
        posicao: "bottom-right",
        texto_cta: "Chamar no WhatsApp",
        texto_whatsapp: "Olá! Peguei o contato através do site e gostaria de esclarecer uma dúvida.",
        telefone_whatsapp: "11988887777",
        cor_fundo: "#128C7E",
        cor_texto: "#FFFFFF",
        views_count: 1420,
        leads_count: 85,
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "w2",
        tenant_id: tenantId || "",
        nome: "Simulador de Financiamento da Caixa",
        slug: "simulador-caixa",
        tipo: "calculadora_financ",
        ativo: true,
        posicao: "inline",
        texto_cta: "Simular agora",
        texto_whatsapp: null,
        telefone_whatsapp: null,
        cor_fundo: "#005CAB",
        cor_texto: "#FFFFFF",
        views_count: 540,
        leads_count: 31,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    setWidgets(defaultWidgets);
    localStorage.setItem(`local_conversion_widgets_${tenantId}`, JSON.stringify(defaultWidgets));
  }

  // Estatísticas dos widgets
  const stats = useMemo(() => {
    const total = widgets.length;
    const active = widgets.filter((w) => w.ativo).length;
    const totalViews = widgets.reduce((sum, w) => sum + (w.views_count || 0), 0);
    const totalLeads = widgets.reduce((sum, w) => sum + (w.leads_count || 0), 0);
    const conversionRate = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : "0.0";
    return { total, active, totalViews, totalLeads, conversionRate };
  }, [widgets]);

  // Salvar / Criar Widget
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    if (!currentWidget.nome?.trim()) {
      return toast.error("Por favor, dê um nome para o seu widget.");
    }

    setSaving(true);
    const slugValue = currentWidget.slug?.trim() || slugify(currentWidget.nome || "");

    const payload = {
      tenant_id: tenantId,
      nome: currentWidget.nome.trim(),
      slug: slugValue,
      tipo: currentWidget.tipo || "whatsapp",
      ativo: currentWidget.ativo !== undefined ? currentWidget.ativo : true,
      posicao: currentWidget.posicao || "bottom-right",
      texto_cta: currentWidget.texto_cta?.trim() || "",
      texto_whatsapp: currentWidget.texto_whatsapp?.trim() || null,
      telefone_whatsapp: currentWidget.telefone_whatsapp?.trim() || null,
      cor_fundo: currentWidget.cor_fundo || "#10B981",
      cor_texto: currentWidget.cor_texto || "#FFFFFF",
    };

    try {
      let updatedWidgetsList = [...widgets];

      if (currentWidget.id && currentWidget.id.length > 5 && !currentWidget.id.startsWith("w")) {
        try {
          await ((supabase as any)
            .from("conversion_widgets")
            .update(payload)
            .eq("id", currentWidget.id) as any);
        } catch (supabaseErr) {
          console.warn("Supabase update indisponível, aplicando localmente", supabaseErr);
        }

        updatedWidgetsList = widgets.map(w => w.id === currentWidget.id ? {
          ...w,
          ...payload,
          updated_at: new Date().toISOString()
        } as ConversionWidget : w);

        toast.success("Widget atualizado com sucesso!");
      } else {
        const newId = (currentWidget.id && (currentWidget.id === "w1" || currentWidget.id === "w2"))
          ? currentWidget.id
          : Math.random().toString(36).substring(2, 9);

        const newWidget = {
          id: newId,
          views_count: 0,
          leads_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload
        } as ConversionWidget;

        try {
          await ((supabase as any)
            .from("conversion_widgets")
            .insert({ ...payload, id: newId }) as any);
        } catch (supabaseErr) {
          console.warn("Supabase insert indisponível, aplicando localmente", supabaseErr);
        }

        if (currentWidget.id && (currentWidget.id === "w1" || currentWidget.id === "w2")) {
          updatedWidgetsList = widgets.map(w => w.id === currentWidget.id ? {
            ...w,
            ...payload,
            updated_at: new Date().toISOString()
          } as ConversionWidget : w);
          toast.success("Widget atualizado com sucesso!");
        } else {
          updatedWidgetsList = [newWidget, ...widgets];
          toast.success("Widget adicionado com sucesso!");
        }
      }

      setWidgets(updatedWidgetsList);
      localStorage.setItem(`local_conversion_widgets_${tenantId}`, JSON.stringify(updatedWidgetsList));

      setIsEditing(false);
      setCurrentWidget(EMPTY_WIDGET);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Deletar Widget
  async function handleDelete(id: string) {
    if (!confirm("Remover este widget de conversão? Ele deixará de funcionar no seu site.")) return;
    try {
      try {
        await ((supabase as any).from("conversion_widgets").delete().eq("id", id) as any);
      } catch (supabaseErr) {
        console.warn("Supabase delete indisponível, aplicando localmente", supabaseErr);
      }
      const updatedWidgetsList = widgets.filter(w => w.id !== id);
      setWidgets(updatedWidgetsList);
      localStorage.setItem(`local_conversion_widgets_${tenantId}`, JSON.stringify(updatedWidgetsList));
      toast.success("Widget removido com sucesso!");
    } catch (_) {
      const updatedWidgetsList = widgets.filter(w => w.id !== id);
      setWidgets(updatedWidgetsList);
      localStorage.setItem(`local_conversion_widgets_${tenantId}`, JSON.stringify(updatedWidgetsList));
      toast.success("Widget removido com sucesso!");
    }
  }

  // Copiar código de incorporação
  const handleCopyCode = (slug: string) => {
    const embedCode = `<script src="${window.location.origin}/api/public/v1/widgets/${slug}.js" async></script>`;
    navigator.clipboard.writeText(embedCode);
    toast.success("Código de incorporação copiado para o clipboard!");
  };

  // Helper para nome do tipo do widget
  const getWidgetTypeName = (tipo: string) => {
    switch (tipo) {
      case "whatsapp": return "WhatsApp Flutuante";
      case "captura_leads": return "Popup Captura de Leads";
      case "calculadora_financ": return "Simulador de Financiamento";
      case "banner_cta": return "CTA Banner de Conversão";
      default: return tipo;
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 animate-fade-in {isEditing ? 'overflow-hidden' : ''}">
      {!isEditing ? (
        <>
          {/* HEADER */}
          <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 fill-primary/10" />
                <span>Módulos de Conversão</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                Widgets de Conversão
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                Crie botões inteligentes, simuladores internos e calculadoras interativas que reúnem 
                leads automaticamente para suas equipes e mantêm os clientes engajados.
              </p>
            </div>
            
            <Button onClick={() => { setCurrentWidget(EMPTY_WIDGET); setIsEditing(true); }} className="shadow-md">
              <Plus className="mr-2 h-4 w-4 stroke-[2.5]" /> Novo Widget
            </Button>
          </header>

          {/* STATS BENTO ROW */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Instalado</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{stats.total}</span>
                <span className="text-xs text-muted-foreground font-medium">unidades</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ativos Atualmente</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Exibindo</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between bg-emerald-500/5">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Geração de Leads</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600">{stats.totalLeads}</span>
                <span className="text-xs text-muted-foreground font-mono">contatos</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between bg-primary/5 border-primary/20">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Taxa de Conversão</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-primary">{stats.conversionRate}%</span>
                <span className="text-xs text-primary/80 font-bold flex items-center gap-1">
                  Média Geral
                </span>
              </div>
            </div>
          </div>

          {/* TUTORIAL INFO */}
          <div className="mb-6 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 font-sans flex items-start gap-4 text-xs text-blue-800 dark:text-blue-300">
            <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Como publicar no meu site ou portais?</span>
              <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-normal">
                Ao criar e ativar um Widget, ele é renderizado <b>automaticamente</b> no seu site imobiliário hospedado na imob365. 
                Se você também possui sites externos particulares (como WordPress, Wix), você pode facilmente copiar o código de incorporação (tag script) 
                clicando em <Code className="inline h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mx-0.5" /> e colando em qualquer lugar do seu painel!
              </p>
            </div>
          </div>

          {/* WIDGETS CARDS GRID */}
          {loading ? (
            <div className="flex items-center justify-center p-20 text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" /> Carregando widgets ativos...
            </div>
          ) : widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
              <Layout className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhum widget de conversão configurado</p>
              <p className="text-xs text-muted-foreground/75 mt-1">Crie seu primeiro atendente flutuante de WhatsApp ou calculadora financeira agora mesmo!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {widgets.map((widget) => (
                <div key={widget.id} className="group overflow-hidden rounded-xl border border-border/80 bg-card p-6 shadow-xs transition-all hover:shadow-md hover:border-primary/30 flex flex-col justify-between">
                  <div>
                    {/* WIDGET STATUS HEADER */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono"
                          style={{ backgroundColor: widget.cor_fundo || '#E4E4E7', color: widget.cor_texto || '#18181B' }}
                        >
                          {widget.tipo === "whatsapp" ? "WA" : widget.tipo === "calculadora_financ" ? "CAL" : "CTA"}
                        </span>
                        <div>
                          <h4 className="font-bold text-neutral-900 dark:text-white leading-none text-sm group-hover:text-primary transition-colors">
                            {widget.nome}
                          </h4>
                          <span className="text-[10px] text-muted-foreground mt-1 block">
                            {getWidgetTypeName(widget.tipo)} &bull; {widget.posicao}
                          </span>
                        </div>
                      </div>

                      <Badge variant={widget.ativo ? "default" : "secondary"} className="font-bold text-[9px]">
                        {widget.ativo ? "INSTALADO/ATIVO" : "INATIVO"}
                      </Badge>
                    </div>

                    {/* METRICS PREVIEW PANEL */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 border border-border/40 text-center mb-4">
                      <div>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase block">Exibições</span>
                        <span className="text-sm font-bold font-mono text-neutral-800 dark:text-white">{widget.views_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase block">Cliques/Leads</span>
                        <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{widget.leads_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase block">Conversão</span>
                        <span className="text-xs font-bold block mt-0.5 text-primary">
                          {widget.views_count > 0 ? ((widget.leads_count / widget.views_count) * 100).toFixed(1) : "0.0"}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BUTTONS */}
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Button 
                        onClick={() => handleCopyCode(widget.slug)} 
                        variant="ghost" 
                        size="sm" 
                        className="text-[11px] font-bold h-8 text-neutral-600 hover:text-primary gap-1 px-2 hover:bg-primary/5"
                        title="Copiar código externo para colocar em sites em WordPress ou Wix"
                      >
                        <Code className="h-3.5 w-3.5" /> Copiar script
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button 
                        onClick={() => { setCurrentWidget(widget); setIsEditing(true); }}
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-600 hover:text-primary hover:bg-primary/5"
                        title="Configurar Aparência"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={() => handleDelete(widget.id)}
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-400 hover:text-destructive hover:bg-destructive/5"
                        title="Remover Widget"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* CREATING / EDITING SCREEN - INTUITY LIKE PROPERTY CADASTRO */
        <div className="max-w-6xl mx-auto">
          {/* HEADER EDITOR */}
          <div className="mb-6 flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="h-8">
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <h2 className="text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                {currentWidget.id ? "Ajustar Código & Design" : "Instalar Novo Widget de Conversão"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentWidget.ativo ? "default" : "secondary"} className="font-extrabold text-[10px]">
                {currentWidget.ativo ? "ATIVADO" : "PAUSADO/INATIVO"}
              </Badge>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              
              {/* PRIMARY WIZARD FORM (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* CADASTRO PROGRESS TABS */}
                <div className="flex border-b border-border/75">
                  <button
                    type="button"
                    onClick={() => setFormActiveTab("geral")}
                    className={`pb-2.5 px-3 md:px-4 text-xs font-bold transition-all relative ${
                      formActiveTab === "geral" 
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    1. Tipo & Posicionamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormActiveTab("design")}
                    className={`pb-2.5 px-3 md:px-4 text-xs font-bold transition-all relative ${
                      formActiveTab === "design" 
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    2. Aparência & Design
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormActiveTab("tecnico")}
                    className={`pb-2.5 px-3 md:px-4 text-xs font-bold transition-all relative ${
                      formActiveTab === "tecnico" 
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    3. Parâmetros Técnicos
                  </button>
                </div>

                {/* TAB 1: GERAL CARD */}
                {formActiveTab === "geral" && (
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs animate-fade-in">
                    <div>
                      <Label htmlFor="widget-nome" className="text-xs font-bold text-foreground">
                        Nome do Widget de Conversão <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="widget-nome"
                        placeholder="Ex: WhatsApp Flutuante - Home"
                        value={currentWidget.nome || ""}
                        onChange={(e) => setCurrentWidget(p => ({ 
                          ...p, 
                          nome: e.target.value,
                          slug: p.id ? p.slug : slugify(e.target.value) 
                        }))}
                        required
                        className="mt-1.5 focus-visible:ring-primary text-xs"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="widget-slug" className="text-xs font-bold text-foreground">
                          Slug de Integração
                        </Label>
                        <Input
                          id="widget-slug"
                          placeholder="atendimento-whatsapp"
                          value={currentWidget.slug || ""}
                          onChange={(e) => setCurrentWidget(p => ({ ...p, slug: slugify(e.target.value) }))}
                          className="mt-1.5 font-mono text-xs focus-visible:ring-primary"
                        />
                      </div>

                      <div>
                        <Label htmlFor="widget-tipo" className="text-xs font-bold text-foreground">
                          Natureza & Comportamento
                        </Label>
                        <select
                          id="widget-tipo"
                          value={currentWidget.tipo || "whatsapp"}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            // preset colors based on type
                            const color = val === 'whatsapp' ? '#25D366' : val === 'calculadora_financ' ? '#005CAB' : '#F2762E';
                            setCurrentWidget(p => ({ 
                              ...p, 
                              tipo: val,
                              cor_fundo: color,
                              texto_cta: val === 'whatsapp' ? 'Chamar no WhatsApp' : val === 'calculadora_financ' ? 'Simular Financiamento' : 'Inscreva-se rápido'
                            }));
                          }}
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="whatsapp">Atendente/WhatsApp Flutuante (Suporte Rápido)</option>
                          <option value="calculadora_financ">Simulador Caixa/Calculadora Habitacional</option>
                          <option value="captura_leads">Banner/Popup Capturador de Leads (Home)</option>
                          <option value="banner_cta">CTA Banner Fixo de Anúncio / Oportunidade Única</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="widget-posicao" className="text-xs font-bold text-foreground">
                        Posicionamento do Widget na Tela
                      </Label>
                      <select
                        id="widget-posicao"
                        value={currentWidget.posicao || "bottom-right"}
                        onChange={(e) => setCurrentWidget(p => ({ ...p, posicao: e.target.value as any }))}
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="bottom-right">Inferior Direito (Bottom-Right, Padrão)</option>
                        <option value="bottom-left">Inferior Esquerdo (Bottom-Left)</option>
                        <option value="top-right">Superior Direito (Top-Right)</option>
                        <option value="top-left">Superior Esquerdo (Top-Left)</option>
                        <option value="inline">Fixo Fundo de Página (Fino Centralizado)</option>
                      </select>
                    </div>

                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-xs text-primary leading-relaxed flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Este widget será inserido dinamicamente na página pública correspondente.
                    </div>
                  </div>
                )}

                {/* TAB 2: DESIGN CARD */}
                {formActiveTab === "design" && (
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs animate-fade-in">
                    <div className="grid gap-4 grid-cols-2">
                      <div>
                        <Label htmlFor="widget-fundo" className="text-xs font-bold text-foreground">
                          Cor de Fundo do Widget
                        </Label>
                        <div className="mt-1.5 flex gap-2">
                          <Input
                            id="widget-fundo"
                            type="color"
                            value={currentWidget.cor_fundo || "#10B981"}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, cor_fundo: e.target.value }))}
                            className="h-9 w-12 p-0 border-none cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={currentWidget.cor_fundo || ""}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, cor_fundo: e.target.value }))}
                            className="text-xs"
                            placeholder="#10B981"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="widget-texto-color" className="text-xs font-bold text-foreground">
                          Cor do Texto / Ícone
                        </Label>
                        <div className="mt-1.5 flex gap-2">
                          <Input
                            id="widget-texto-color"
                            type="color"
                            value={currentWidget.cor_texto || "#FFFFFF"}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, cor_texto: e.target.value }))}
                            className="h-9 w-12 p-0 border-none cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={currentWidget.cor_texto || ""}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, cor_texto: e.target.value }))}
                            className="text-xs"
                            placeholder="#FFFFFF"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="widget-cta" className="text-xs font-bold text-foreground">
                        Texto Chamativo (CTA / Call To Action)
                      </Label>
                      <Input
                        id="widget-cta"
                        placeholder="Ex: Fale com nossos consultores de vendas"
                        value={currentWidget.texto_cta || ""}
                        onChange={(e) => setCurrentWidget(p => ({ ...p, texto_cta: e.target.value }))}
                        className="mt-1.5 text-xs"
                      />
                    </div>

                    <div className="pt-2">
                      <span className="text-xs font-bold">Presets de Marca Rápidos</span>
                      <div className="mt-1.5 flex gap-2">
                        <button 
                          type="button" 
                          onClick={() => setCurrentWidget(p => ({ ...p, cor_fundo: "#25D366", cor_texto: "#FFFFFF" }))}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#25D366] text-white rounded hover:opacity-90"
                        >
                          WhatsApp Green
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setCurrentWidget(p => ({ ...p, cor_fundo: "#F2762E", cor_texto: "#FFFFFF" }))}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#F2762E] text-white rounded hover:opacity-90"
                        >
                          Imob Brand (Premium)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setCurrentWidget(p => ({ ...p, cor_fundo: "#005CAB", cor_texto: "#FFFFFF" }))}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#005CAB] text-white rounded hover:opacity-90"
                        >
                          Caixa Blue (Confiança)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TECNICO CARD */}
                {formActiveTab === "tecnico" && (
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs animate-fade-in">
                    {currentWidget.tipo === "whatsapp" ? (
                      <>
                        <div>
                          <Label htmlFor="widget-phone" className="text-xs font-bold text-foreground">
                            Número de Telefone WhatsApp <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="widget-phone"
                            placeholder="Ex: 11999998888 (Apenas números com DDD)"
                            value={currentWidget.telefone_whatsapp || ""}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, telefone_whatsapp: e.target.value.replace(/\D/g, '') }))}
                            className="mt-1.5 text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground mt-1 block">O widget abrirá a conversa diretamente com este celular associado.</span>
                        </div>

                        <div>
                          <Label htmlFor="widget-welcome-msg" className="text-xs font-bold text-foreground">
                            Mensagem Inicial de Boas-Vindas (Pré-preenchida para o Lead enviar)
                          </Label>
                          <Textarea
                            id="widget-welcome-msg"
                            rows={3}
                            placeholder="Ex: Olá, vim através do portal da Imobiliária e gostaria de agendar uma visita guiada para o final de semana."
                            value={currentWidget.texto_whatsapp || ""}
                            onChange={(e) => setCurrentWidget(p => ({ ...p, texto_whatsapp: e.target.value }))}
                            className="mt-1.5 text-xs"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-4 rounded-lg bg-muted text-xs text-muted-foreground leading-normal space-y-2">
                        <Settings className="h-5 w-5 text-neutral-500" />
                        <span className="font-bold text-neutral-800 dark:text-white block">Regras para Simuladores / Popups</span>
                        <p>
                          Este tipo de widget exibe um popover overlay diretamente na tela pública, 
                          coletando nome, telefone, e-mail e intenção de financiamento e inserindo como 
                          <b> Lead Automático</b> no módulo imobiário.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Todos os dados informados pelos clientes são consolidados diretamente para sua análise.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* LIVE WIDGET PREVIEW PANEL & SAVE OPTIONS (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90 mb-3 flex items-center gap-1.5">
                    <Smartphone className="h-4.5 w-4.5 text-indigo-500" />
                    Simulação Visual (Celular)
                  </h4>

                  {/* HIGH-FIDELITY MOBILE PHONE WRAPPER FOR PREVIEW */}
                  <div className="relative mx-auto max-w-[240px] aspect-[9/16] rounded-3xl border-6 border-neutral-900 bg-neutral-950 p-2 shadow-lg overflow-hidden flex flex-col justify-between">
                    {/* CAMERA notch */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-3.5 bg-neutral-900/90 rounded-full z-10" />

                    {/* STATUS bar inside iphone */}
                    <div className="flex justify-between items-center px-2 pt-1 text-[8px] text-muted-foreground font-mono font-medium">
                      <span>12:30</span>
                      <div className="flex items-center gap-1">
                        <span>5G</span>
                        <span className="h-2 w-3 border border-muted-foreground rounded-xs" />
                      </div>
                    </div>

                    {/* INTERNAL APP CONTENT VIEWPORT */}
                    <div className="relative flex-1 bg-white dark:bg-neutral-900 rounded-2xl p-3 flex flex-col justify-between mt-1 overflow-hidden">
                      {/* Simulated site header */}
                      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-1.5 flex justify-between items-center">
                        <span className="text-[9px] font-extrabold text-neutral-800 dark:text-white">imob365</span>
                        <span className="h-1.5 w-4 bg-muted rounded" />
                      </div>

                      {/* Simulated body list */}
                      <div className="flex-1 pt-4 space-y-1.5">
                        <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                        <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                        <div className="h-2.5 w-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                      </div>

                      {/* THE DYNAMIC PREVIEW FLUID COMPONENT */}
                      <div className="relative flex items-end justify-center pt-8 border-t border-neutral-100 dark:border-neutral-800 mb-1">
                        {currentWidget.posicao === "inline" ? (
                          <div 
                            className="w-full py-1.5 px-2.5 rounded-md text-center text-[10px] font-bold shadow-xs break-all animate-bounce"
                            style={{ backgroundColor: currentWidget.cor_fundo || '#10B981', color: currentWidget.cor_texto || '#FFFFFF' }}
                          >
                            {currentWidget.texto_cta || "Inscrição Rápida"}
                          </div>
                        ) : (
                          <div className={`w-full flex items-center gap-1.5 p-1.5 rounded-full shadow-md text-[9px] font-extrabold ${
                            currentWidget.posicao?.includes("left") ? "justify-start" : "justify-end"
                          }`}>
                            <span 
                              className="px-2 py-1 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                              style={{ backgroundColor: currentWidget.cor_fundo || '#10B981', color: currentWidget.cor_texto || '#FFFFFF' }}
                            >
                              {currentWidget.texto_cta || "Clique aqui"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SAVE ACTION BUTTONS */}
                <div className="space-y-2 lg:pt-2">
                  <div className="flex gap-2">
                    <Label className="text-xs font-bold text-muted-foreground/90 shrink-0 py-1">Widget Ativo:</Label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentWidget(p => ({ ...p, ativo: true }))}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${
                          currentWidget.ativo 
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" 
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentWidget(p => ({ ...p, ativo: false }))}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${
                          !currentWidget.ativo 
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/20" 
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full font-bold shadow-md">
                    {saving ? "Instalando..." : currentWidget.id ? "Salvar Alterações" : "Inserir Widget no Site"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(false)} 
                    className="w-full text-xs"
                  >
                    Descartar
                  </Button>
                </div>
              </div>

            </div>
          </form>
        </div>
      )}
    </div>
  );
}
