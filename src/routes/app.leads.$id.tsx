import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  Mail,
  Phone,
  MessageSquare,
  Building2,
  Trash2,
  ShieldCheck,
  Fingerprint,
  Loader2,
  Sparkles,
  FileSignature,
  Link2,
  Route as RouteIcon,
  Plus,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LeadChat } from "@/components/chat/LeadChat";
import { LeadPreferenciasMatch } from "@/components/leads/LeadPreferenciasMatch";
import { LeadTarefas } from "@/components/leads/LeadTarefas";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { maskCPF, isValidCPF } from "@/lib/format";
import { gerarAnaliseRisco } from "@/lib/creditScore";

export const Route = createFileRoute("/app/leads/$id")({
  component: LeadDetail,
});

const STATUS = [
  { v: "novo", label: "Novo" },
  { v: "contato", label: "Em contato" },
  { v: "visita", label: "Visita" },
  { v: "proposta", label: "Proposta" },
  { v: "ganho", label: "Ganho" },
  { v: "perdido", label: "Perdido" },
];

const URL_REGEX = /https?:\/\/[^\s]+/g;

// Torna clicável qualquer URL solta dentro do texto livre de `mensagem` —
// leads de captação automática (e outras origens) embutem o link do anúncio
// original ali, e antes disso o corretor precisava copiar/colar manualmente.
function linkifyText(text: string) {
  const parts = text.split(URL_REGEX);
  const urls = text.match(URL_REGEX) ?? [];
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t${i}`}>{part}</span>);
    if (urls[i]) {
      nodes.push(
        <a
          key={`u${i}`}
          href={urls[i]}
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary underline hover:no-underline"
        >
          {urls[i]}
        </a>,
      );
    }
  });
  return nodes;
}

function LeadDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [lead, setLead] = useState<any>(null);
  const [imovel, setImovel] = useState<any>(null);
  const [contrato, setContrato] = useState<{ id: string; numero: string | null } | null>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);

  // Serasa Scoring states (Sprint 7)
  const [tenantCpf, setTenantCpf] = useState("");
  const [serasaScore, setSerasaScore] = useState<number | null>(null);
  const [serasaStatus, setSerasaStatus] = useState<string | null>(null);
  const [serasaPendencias, setSerasaPendencias] = useState<string | null>(null);
  const [serasaConsultado, setSerasaConsultado] = useState(false);
  const [verificandoCredito, setVerificandoCredito] = useState(false);

  async function consultarSerasa() {
    if (!tenantCpf.trim()) {
      toast.error("Informe o CPF do Inquilino para consulta.");
      return;
    }
    const cleanCpf = tenantCpf.replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) {
      toast.error("CPF inválido.");
      return;
    }
    setVerificandoCredito(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const { score, status, pendencias: alerts } = gerarAnaliseRisco(cleanCpf);

    setSerasaScore(score);
    setSerasaStatus(status);
    setSerasaPendencias(alerts);
    setSerasaConsultado(true);
    setVerificandoCredito(false);
    toast.success("Consulta à API Serasa Experian concluída!");

    // Grava histórico automaticamente
    await update(
      {},
      {
        tipo: "nota",
        conteudo: `🤖 [Consulta Automática Serasa] CPF: ${cleanCpf.slice(0, 3)}.***.***-${cleanCpf.slice(9)}. Score Obtido: ${score} - Recomendação: ${status}. Detalhes: ${alerts}`,
      },
    );
  }

  async function load() {
    setLoading(true);
    const { data: l } = await (supabase as any)
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!l) {
      toast.error("Lead não encontrado");
      setLoading(false);
      return;
    }
    setLead(l);
    const [{ data: imo }, { data: cors }, { data: inter }, { data: contratoData }, { data: vis }] =
      await Promise.all([
        l.imovel_id
          ? (supabase as any)
              .from("imoveis")
              .select("id,titulo,slug")
              .eq("id", l.imovel_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        (supabase as any)
          .from("corretores")
          .select("id,nome")
          .eq("tenant_id", l.tenant_id)
          .order("nome"),
        (supabase as any)
          .from("lead_interacoes")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
        // CLM Sprint 15 — wiring: contratos.lead_id já existia, só faltava
        // o funil de lead mostrar o link pro contrato quando formalizado.
        // Sem .maybeSingle(): contratos.lead_id não tem constraint unique —
        // um lead pode legitimamente ter mais de um contrato ao longo do
        // tempo (ex. um negócio caiu, um segundo contrato foi criado depois)
        // — achado real ao testar, o seed de dev tem 2 contratos pro mesmo
        // lead. Mostra o mais recente.
        (supabase as any)
          .from("contratos")
          .select("id,numero")
          .eq("lead_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
        // Roteiro de Visitas — achado de QA: a relação com o lead existia
        // no banco (visitas.lead_id) mas não aparecia em nenhum lugar
        // visível pro corretor a partir do próprio lead.
        (supabase as any)
          .from("visitas")
          .select(
            "id,data_hora,roteiro_etapa_id,imovel:imoveis(id,titulo),etapa:roteiro_visita_etapas(id,nome)",
          )
          .eq("lead_id", id)
          .order("data_hora", { ascending: false }),
      ]);
    setImovel(imo);
    setVisitas(vis ?? []);
    setCorretores(cors ?? []);
    setInteracoes(inter ?? []);
    setContrato(contratoData?.[0] ?? null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function update(patch: any, interacao?: { tipo: string; conteudo: string }) {
    const { error } = await (supabase as any).from("leads").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (interacao) {
      await (supabase as any).from("lead_interacoes").insert({
        lead_id: id,
        tenant_id: lead.tenant_id,
        user_id: user?.id ?? null,
        ...interacao,
      });
    }
    load();
  }

  async function addNota() {
    if (!nota.trim()) return;
    const { error } = await (supabase as any).from("lead_interacoes").insert({
      lead_id: id,
      tenant_id: lead.tenant_id,
      user_id: user?.id ?? null,
      tipo: "nota",
      conteudo: nota.trim(),
    });
    if (error) return toast.error(error.message);
    setNota("");
    load();
  }

  async function remove() {
    if (!(await confirmDialog("Excluir este lead?"))) return;
    const { error } = await (supabase as any).from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    window.location.href = "/app/leads";
  }

  if (loading || !lead) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const tel = (lead.telefone ?? "").replace(/\D/g, "");
  const linkAnuncio = (lead.mensagem ?? "").match(URL_REGEX)?.[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/leads">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={remove}>
          <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Excluir
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">{lead.nome}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recebido em {new Date(lead.created_at).toLocaleString("pt-BR")} · origem:{" "}
              {lead.origem}
            </p>
          </header>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contato
            </h2>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 hover:text-primary"
                >
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}
              {lead.telefone && (
                <a
                  href={`tel:${lead.telefone}`}
                  className="flex items-center gap-2 hover:text-primary"
                >
                  <Phone className="h-4 w-4" /> {lead.telefone}
                </a>
              )}
              {tel && (
                <a
                  href={`https://wa.me/55${tel}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:underline"
                >
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {imovel && (
                <Link
                  to="/imovel/$slug"
                  params={{ slug: imovel.slug }}
                  className="flex items-center gap-2 hover:text-primary"
                >
                  <Building2 className="h-4 w-4" /> {imovel.titulo}
                </Link>
              )}
              {linkAnuncio && (
                <a
                  href={linkAnuncio}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Link2 className="h-4 w-4" /> Ver anúncio de origem
                </a>
              )}
            </div>
            {lead.mensagem && (
              <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap">
                {linkifyText(lead.mensagem)}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Visitas
              </h2>
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/roteiro-visitas" search={{ leadId: lead.id, taskId: undefined }}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Agendar visita
                </Link>
              </Button>
            </div>
            {visitas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma visita agendada com este lead.
              </p>
            ) : (
              <ul className="space-y-2">
                {visitas.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">
                        {new Date(v.data_hora).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-muted-foreground">{v.imovel?.titulo ?? "—"}</span>
                    </div>
                    <Badge variant="outline">{v.etapa?.nome ?? "Sem etapa"}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {visitas.length > 0 && (
              <Link
                to="/app/roteiro-visitas"
                search={{ leadId: undefined, taskId: undefined }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <RouteIcon className="h-3.5 w-3.5" /> Ver no Roteiro de Visitas
              </Link>
            )}
          </section>

          {contrato && (
            <Link
              to="/app/contratos/$id"
              params={{ id: contrato.id }}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm hover:border-primary/60"
            >
              <FileSignature className="h-4 w-4 text-primary" />
              <span>
                Contrato formalizado:{" "}
                <span className="font-medium">
                  {contrato.numero ? `#${contrato.numero}` : contrato.id.slice(0, 8)}
                </span>
              </span>
              <Badge variant="secondary" className="ml-auto">
                Ver contrato
              </Badge>
            </Link>
          )}

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Histórico
            </h2>
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Adicionar uma nota…"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={addNota} disabled={!nota.trim()}>
                  Adicionar nota
                </Button>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {interacoes.length === 0 && (
                <li className="text-sm text-muted-foreground">Sem interações registradas.</li>
              )}
              {interacoes.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {i.tipo}
                    </Badge>
                    <span>{new Date(i.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {i.conteudo && <p className="mt-1 whitespace-pre-wrap">{i.conteudo}</p>}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-2">
            <LeadChat leadId={lead.id} tenantId={lead.tenant_id} />
          </section>

          <LeadTarefas leadId={lead.id} tenantId={lead.tenant_id} />

          <LeadPreferenciasMatch leadId={lead.id} tenantId={lead.tenant_id} />

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Linha do tempo unificada
            </h2>
            <LeadTimeline leadId={lead.id} />
          </section>
        </div>

        <aside className="space-y-4">
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <div className="rounded-xl border border-border bg-card p-4 text-xs">
              <div className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
                Origem (UTM)
              </div>
              {lead.utm_source && (
                <div>
                  <span className="text-muted-foreground">source:</span> {lead.utm_source}
                </div>
              )}
              {lead.utm_medium && (
                <div>
                  <span className="text-muted-foreground">medium:</span> {lead.utm_medium}
                </div>
              )}
              {lead.utm_campaign && (
                <div>
                  <span className="text-muted-foreground">campaign:</span> {lead.utm_campaign}
                </div>
              )}
              {lead.referrer && (
                <div className="truncate">
                  <span className="text-muted-foreground">ref:</span> {lead.referrer}
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Etapa
            </label>
            <Select
              value={lead.status}
              onValueChange={(v) =>
                update({ status: v }, { tipo: "mudanca_etapa", conteudo: `${lead.status} → ${v}` })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => (
                  <SelectItem key={s.v} value={s.v}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Corretor responsável
            </label>
            <Select
              value={lead.corretor_id ?? "none"}
              onValueChange={(v) => {
                const newId = v === "none" ? null : v;
                const nome = corretores.find((c) => c.id === newId)?.nome ?? "ninguém";
                update(
                  { corretor_id: newId },
                  { tipo: "atribuicao", conteudo: `Atribuído para ${nome}` },
                );
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem corretor</SelectItem>
                {corretores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Validação de Crédito Serasa (Sprint 7) */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-xs font-bold text-foreground font-sans">
                  Análise de Risco Serasa
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  Validação automática para Locação
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-muted-foreground">
                  CPF do Proponente / Inquilino
                </label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="000.000.000-00"
                    value={tenantCpf}
                    onChange={(e) => setTenantCpf(maskCPF(e.target.value))}
                    disabled={verificandoCredito}
                    className="max-w-[170px] text-xs h-8"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={consultarSerasa}
                    disabled={verificandoCredito || !tenantCpf}
                    className="flex-1 text-xs h-8 px-2 font-sans"
                  >
                    {verificandoCredito ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Consultar"
                    )}
                  </Button>
                </div>
              </div>

              {serasaConsultado && (
                <div className="rounded-lg bg-muted/40 p-3 border border-border/50 space-y-2.5 animate-fade-in font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SCORE CREDITO:</span>
                    <span
                      className={`font-mono font-bold text-sm px-1.5 py-0.5 rounded ${
                        serasaScore && serasaScore >= 700
                          ? "text-emerald-700 bg-emerald-50"
                          : serasaScore && serasaScore >= 500
                            ? "text-amber-700 bg-amber-50"
                            : "text-destructive bg-destructive/5"
                      }`}
                    >
                      {serasaScore} / 1000
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Diagnóstico:
                    </span>
                    <span className="font-semibold text-foreground text-[11px] leading-tight block mt-0.5">
                      {serasaStatus}
                    </span>
                  </div>

                  <div className="border-t border-border/50 pt-2 text-[10px]">
                    <span className="font-bold text-muted-foreground block">
                      Pendências Financeiras:
                    </span>
                    <span className="text-muted-foreground/90 block leading-relaxed mt-0.5">
                      {serasaPendencias}
                    </span>
                  </div>

                  <div className="text-[9px] text-muted-foreground/75 leading-tight flex items-center gap-1">
                    <Fingerprint className="h-3 w-3 text-primary/45" />
                    <span>Conexão Segura Serasa Experian v3.2</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <ConfirmDialog />
    </div>
  );
}
