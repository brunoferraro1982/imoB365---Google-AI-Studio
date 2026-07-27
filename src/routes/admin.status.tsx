import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/status")({
  component: AdminStatusPage,
});

type StatusValue = "operational" | "degraded" | "outage";
type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
type Impacto = "minor" | "major" | "critical";

type Servico = {
  id: string;
  slug: string;
  nome_exibicao: string;
  descricao: string | null;
  link_gerenciamento: string | null;
  ativo: boolean;
  ultimoStatus: StatusValue | null;
  ultimaLatencia: number | null;
  ultimaMensagem: string | null;
  ultimaChecagem: string | null;
};

type IncidentUpdate = { id: string; status: IncidentStatus; mensagem: string; created_at: string };

type Incidente = {
  id: string;
  titulo: string;
  status: IncidentStatus;
  impacto: Impacto;
  started_at: string;
  resolved_at: string | null;
  servicos: string[];
  updates: IncidentUpdate[];
};

const STATUS_LABEL: Record<StatusValue, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  outage: "Fora do ar",
};

const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: "Investigando",
  identified: "Identificado",
  monitoring: "Monitorando",
  resolved: "Resolvido",
};

const IMPACTO_LABEL: Record<Impacto, string> = {
  minor: "Menor",
  major: "Relevante",
  critical: "Crítico",
};

function StatusIcon({ status }: { status: StatusValue | null }) {
  if (status === "operational")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === "degraded")
    return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (status === "outage") return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <span className="text-xs text-muted-foreground">sem dado</span>;
}

function AdminStatusPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoImpacto, setNovoImpacto] = useState<Impacto>("minor");
  const [novaMensagem, setNovaMensagem] = useState("");
  const [novosServicos, setNovosServicos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const [{ data: servicosRaw, error: e1 }, { data: incidentesRaw, error: e2 }] =
        await Promise.all([
          (supabase as any).from("status_services").select("*").order("ordem", { ascending: true }),
          (supabase as any)
            .from("status_incidents")
            .select(
              "id,titulo,status,impacto,started_at,resolved_at,status_incident_updates(id,status,mensagem,created_at),status_incident_services(service_id,status_services(nome_exibicao))",
            )
            .order("started_at", { ascending: false })
            .limit(50),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const lista = (servicosRaw ?? []) as any[];
      const comUltimoStatus: Servico[] = await Promise.all(
        lista.map(async (s) => {
          const { data: ultimo } = await (supabase as any)
            .from("status_checks")
            .select("status,latency_ms,mensagem,checked_at")
            .eq("service_id", s.id)
            .order("checked_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            id: s.id,
            slug: s.slug,
            nome_exibicao: s.nome_exibicao,
            descricao: s.descricao,
            link_gerenciamento: s.link_gerenciamento,
            ativo: s.ativo,
            ultimoStatus: (ultimo?.status as StatusValue | undefined) ?? null,
            ultimaLatencia: ultimo?.latency_ms ?? null,
            ultimaMensagem: ultimo?.mensagem ?? null,
            ultimaChecagem: ultimo?.checked_at ?? null,
          };
        }),
      );
      setServicos(comUltimoStatus);

      const incidentesMapeados: Incidente[] = ((incidentesRaw ?? []) as any[]).map((i) => ({
        id: i.id,
        titulo: i.titulo,
        status: i.status,
        impacto: i.impacto,
        started_at: i.started_at,
        resolved_at: i.resolved_at,
        servicos: (i.status_incident_services ?? [])
          .map((x: any) => x.status_services?.nome_exibicao)
          .filter(Boolean),
        updates: (i.status_incident_updates ?? []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      }));
      setIncidentes(incidentesMapeados);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleNovoServico(id: string) {
    setNovosServicos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function criarIncidente() {
    if (!novoTitulo.trim() || !novaMensagem.trim()) {
      toast.error("Preencha título e mensagem inicial.");
      return;
    }
    setSalvando(true);
    try {
      const { data: incidente, error } = await (supabase as any)
        .from("status_incidents")
        .insert({ titulo: novoTitulo.trim(), status: "investigating", impacto: novoImpacto })
        .select("id")
        .single();
      if (error) throw error;

      await (supabase as any).from("status_incident_updates").insert({
        incident_id: incidente.id,
        status: "investigating",
        mensagem: novaMensagem.trim(),
      });

      if (novosServicos.size > 0) {
        await (supabase as any).from("status_incident_services").insert(
          Array.from(novosServicos).map((service_id) => ({
            incident_id: incidente.id,
            service_id,
          })),
        );
      }

      toast.success("Incidente criado.");
      setNovoAberto(false);
      setNovoTitulo("");
      setNovaMensagem("");
      setNovoImpacto("minor");
      setNovosServicos(new Set());
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar incidente");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarAtualizacao(incidenteId: string, novoStatus: IncidentStatus) {
    const mensagem = (updateDrafts[incidenteId] ?? "").trim();
    if (!mensagem) {
      toast.error("Escreva uma mensagem de atualização.");
      return;
    }
    try {
      await (supabase as any)
        .from("status_incident_updates")
        .insert({ incident_id: incidenteId, status: novoStatus, mensagem });
      await (supabase as any)
        .from("status_incidents")
        .update({
          status: novoStatus,
          updated_at: new Date().toISOString(),
          ...(novoStatus === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
        })
        .eq("id", incidenteId);
      setUpdateDrafts((prev) => ({ ...prev, [incidenteId]: "" }));
      toast.success("Atualização registrada.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar incidente");
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Status & Infraestrutura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoramento interno dos serviços (checagem automática a cada 5 minutos) e gestão de
          incidentes exibidos publicamente em{" "}
          <a
            href="/status"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            /status
          </a>
          .
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4 font-medium">Serviços monitorados</div>
        <div className="divide-y divide-border">
          {servicos.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {s.nome_exibicao}
                  <span className="text-xs font-normal text-muted-foreground">({s.slug})</span>
                </div>
                {s.descricao && <div className="text-xs text-muted-foreground">{s.descricao}</div>}
                {s.ultimaMensagem && (
                  <div
                    className="mt-1 truncate text-xs text-red-600 dark:text-red-400"
                    title={s.ultimaMensagem}
                  >
                    {s.ultimaMensagem}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-xs text-muted-foreground">
                  {s.ultimaLatencia != null ? `${s.ultimaLatencia}ms` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.ultimaChecagem
                    ? new Date(s.ultimaChecagem).toLocaleString("pt-BR")
                    : "sem checagem ainda"}
                </span>
                <StatusIcon status={s.ultimoStatus} />
                {s.link_gerenciamento && (
                  <a
                    href={s.link_gerenciamento}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title="Abrir gerenciamento"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-medium">Incidentes</span>
          <Button size="sm" variant="outline" onClick={() => setNovoAberto((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo incidente
          </Button>
        </div>

        {novoAberto && (
          <div className="space-y-3 border-b border-border bg-muted/30 p-4">
            <Input
              placeholder="Título do incidente"
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={novoImpacto} onValueChange={(v) => setNovoImpacto(v as Impacto)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["minor", "major", "critical"] as Impacto[]).map((i) => (
                    <SelectItem key={i} value={i}>
                      {IMPACTO_LABEL[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                {servicos.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleNovoServico(s.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      novosServicos.has(s.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {s.nome_exibicao}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Mensagem inicial (o que está acontecendo)"
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNovoAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={criarIncidente} disabled={salvando}>
                Criar incidente
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {incidentes.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhum incidente registrado.</div>
          )}
          {incidentes.map((i) => (
            <div key={i.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{i.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {IMPACTO_LABEL[i.impacto]} ·{" "}
                    {i.servicos.join(", ") || "nenhum serviço vinculado"} ·{" "}
                    {new Date(i.started_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    i.status === "resolved"
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {INCIDENT_STATUS_LABEL[i.status]}
                </span>
              </div>

              {i.updates.length > 0 && (
                <ul className="space-y-1 border-l border-border pl-4 text-sm">
                  {i.updates.map((u) => (
                    <li key={u.id}>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleString("pt-BR")}
                      </span>{" "}
                      <span className="font-medium">{INCIDENT_STATUS_LABEL[u.status]}:</span>{" "}
                      {u.mensagem}
                    </li>
                  ))}
                </ul>
              )}

              {i.status !== "resolved" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Nova atualização"
                    value={updateDrafts[i.id] ?? ""}
                    onChange={(e) =>
                      setUpdateDrafts((prev) => ({ ...prev, [i.id]: e.target.value }))
                    }
                    className="max-w-md"
                  />
                  {(["identified", "monitoring", "resolved"] as IncidentStatus[]).map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant="outline"
                      onClick={() => adicionarAtualizacao(i.id, st)}
                    >
                      {INCIDENT_STATUS_LABEL[st]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
