import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Mail, Phone, MessageSquare, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LeadChat } from "@/components/chat/LeadChat";
import { LeadPreferenciasMatch } from "@/components/leads/LeadPreferenciasMatch";
import { LeadTarefas } from "@/components/leads/LeadTarefas";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { toast } from "sonner";

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

function LeadDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [imovel, setImovel] = useState<any>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: l } = await (supabase as any).from("leads").select("*").eq("id", id).maybeSingle();
    if (!l) { toast.error("Lead não encontrado"); setLoading(false); return; }
    setLead(l);
    const [{ data: imo }, { data: cors }, { data: inter }] = await Promise.all([
      l.imovel_id
        ? (supabase as any).from("imoveis").select("id,titulo,slug").eq("id", l.imovel_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase as any).from("corretores").select("id,nome").eq("tenant_id", l.tenant_id).order("nome"),
      (supabase as any).from("lead_interacoes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    setImovel(imo);
    setCorretores(cors ?? []);
    setInteracoes(inter ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function update(patch: any, interacao?: { tipo: string; conteudo: string }) {
    const { error } = await (supabase as any).from("leads").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (interacao) {
      await (supabase as any).from("lead_interacoes").insert({
        lead_id: id, tenant_id: lead.tenant_id, user_id: user?.id ?? null, ...interacao,
      });
    }
    load();
  }

  async function addNota() {
    if (!nota.trim()) return;
    const { error } = await (supabase as any).from("lead_interacoes").insert({
      lead_id: id, tenant_id: lead.tenant_id, user_id: user?.id ?? null, tipo: "nota", conteudo: nota.trim(),
    });
    if (error) return toast.error(error.message);
    setNota("");
    load();
  }

  async function remove() {
    if (!confirm("Excluir este lead?")) return;
    const { error } = await (supabase as any).from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    window.location.href = "/app/leads";
  }

  if (loading || !lead) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const tel = (lead.telefone ?? "").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/leads"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link>
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
              Recebido em {new Date(lead.created_at).toLocaleString("pt-BR")} · origem: {lead.origem}
            </p>
          </header>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contato</h2>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 hover:text-primary">
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="h-4 w-4" /> {lead.telefone}
                </a>
              )}
              {tel && (
                <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-600 hover:underline">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {imovel && (
                <Link to="/imovel/$slug" params={{ slug: imovel.slug }} className="flex items-center gap-2 hover:text-primary">
                  <Building2 className="h-4 w-4" /> {imovel.titulo}
                </Link>
              )}
            </div>
            {lead.mensagem && (
              <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap">{lead.mensagem}</div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico</h2>
            <div className="space-y-2">
              <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Adicionar uma nota…" />
              <div className="flex justify-end">
                <Button size="sm" onClick={addNota} disabled={!nota.trim()}>Adicionar nota</Button>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {interacoes.length === 0 && <li className="text-sm text-muted-foreground">Sem interações registradas.</li>}
              {interacoes.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{i.tipo}</Badge>
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
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Linha do tempo unificada</h2>
            <LeadTimeline leadId={lead.id} />
          </section>
        </div>

        <aside className="space-y-4">
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <div className="rounded-xl border border-border bg-card p-4 text-xs">
              <div className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">Origem (UTM)</div>
              {lead.utm_source && <div><span className="text-muted-foreground">source:</span> {lead.utm_source}</div>}
              {lead.utm_medium && <div><span className="text-muted-foreground">medium:</span> {lead.utm_medium}</div>}
              {lead.utm_campaign && <div><span className="text-muted-foreground">campaign:</span> {lead.utm_campaign}</div>}
              {lead.referrer && <div className="truncate"><span className="text-muted-foreground">ref:</span> {lead.referrer}</div>}
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Etapa</label>
            <Select value={lead.status} onValueChange={(v) => update({ status: v }, { tipo: "mudanca_etapa", conteudo: `${lead.status} → ${v}` })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Corretor responsável</label>
            <Select
              value={lead.corretor_id ?? "none"}
              onValueChange={(v) => {
                const newId = v === "none" ? null : v;
                const nome = corretores.find((c) => c.id === newId)?.nome ?? "ninguém";
                update({ corretor_id: newId }, { tipo: "atribuicao", conteudo: `Atribuído para ${nome}` });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Sem corretor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem corretor</SelectItem>
                {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </aside>
      </div>
    </div>
  );
}