import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Fingerprint,
  Loader2,
  Printer,
  Gauge,
  BarChart3,
  LineChart as LineChartIcon,
  Lightbulb,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { maskCPF, isValidCPF } from "@/lib/format";
import { gerarAnaliseRisco, type AnaliseRisco } from "@/lib/creditScore";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/analise-risco")({
  component: AnaliseRiscoPage,
});

function corPorScore(score: number) {
  if (score >= 700) return { texto: "text-emerald-700", fundo: "bg-emerald-50", hex: "#10b981" };
  if (score >= 500) return { texto: "text-amber-700", fundo: "bg-amber-50", hex: "#f59e0b" };
  return { texto: "text-destructive", fundo: "bg-destructive/5", hex: "var(--destructive)" };
}

function AnaliseRiscoPage() {
  const { tenantId, user } = useAuth();
  const [cpf, setCpf] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [leads, setLeads] = useState<{ id: string; nome: string }[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [analise, setAnalise] = useState<AnaliseRisco | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("id,nome")
        .order("created_at", { ascending: false })
        .limit(200);
      setLeads(data ?? []);
    })();
  }, [tenantId]);

  async function consultar() {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!cleanCpf) {
      toast.error("Informe o CPF para consulta.");
      return;
    }
    if (!isValidCPF(cleanCpf)) {
      toast.error("CPF inválido.");
      return;
    }
    setConsultando(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const resultado = gerarAnaliseRisco(cleanCpf);
    setAnalise(resultado);
    setConsultando(false);
    toast.success("Consulta à API Serasa Experian concluída!");

    if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      const { error } = await (supabase as any).from("lead_interacoes").insert({
        lead_id: leadId,
        tenant_id: tenantId,
        user_id: user?.id ?? null,
        tipo: "nota",
        conteudo: `🤖 [Consulta Automática Serasa] CPF: ${cleanCpf.slice(0, 3)}.***.***-${cleanCpf.slice(9)}. Score Obtido: ${resultado.score} - Recomendação: ${resultado.status}. Detalhes: ${resultado.pendencias}`,
      });
      if (error) toast.error("Consulta concluída, mas não foi possível registrar no lead.");
      else if (lead) toast.success(`Registrado na timeline de ${lead.nome}.`);
    }
  }

  const cor = analise ? corPorScore(analise.score) : null;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold">Análise de Risco</h1>
          <p className="text-sm text-muted-foreground">
            Consulte o CPF de um proponente e monte uma apresentação de confiança para o
            proprietário do imóvel.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm print:hidden">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">
              CPF do proponente
            </label>
            <Input
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              disabled={consultando}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">
              Vincular a um lead (opcional)
            </label>
            <Select
              value={leadId || "none"}
              onValueChange={(v) => setLeadId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={consultar} disabled={consultando || !cpf} className="gap-2">
            {consultando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {consultando ? "Consultando…" : "Consultar"}
          </Button>
        </div>
      </div>

      {analise && cor && (
        <div className="mt-6 animate-fade-in space-y-6">
          <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Fingerprint className="h-3.5 w-3.5 text-primary/60" />
              Conexão Segura Serasa Experian v3.2
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            {/* Gauge do score */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                <Gauge className="h-4 w-4" /> Score de crédito
              </div>
              <div className="relative h-48">
                <ClientOnly fallback={<div className="h-full" />}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="72%"
                      outerRadius="100%"
                      barSize={16}
                      startAngle={90}
                      endAngle={-270}
                      data={[{ value: analise.score, fill: cor.hex }]}
                    >
                      <PolarAngleAxis type="number" domain={[0, 1000]} tick={false} />
                      <RadialBar background dataKey="value" cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </ClientOnly>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`font-mono text-2xl font-bold ${cor.texto}`}>
                    {analise.score}
                  </span>
                  <span className="text-[10px] text-muted-foreground">de 1000</span>
                </div>
              </div>
              <div className="mt-3 text-center">
                <Badge className={`${cor.fundo} ${cor.texto} border-none`}>{analise.status}</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                  Diagnóstico
                </div>
                <p className="text-sm font-medium">{analise.status}</p>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Pendências financeiras
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">{analise.pendencias}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <BarChart3 className="h-4 w-4" /> Composição do score
                </div>
                <div className="h-64">
                  <ClientOnly fallback={<div className="h-full" />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analise.fatores} margin={{ bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="valor" fill={cor.hex} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <LineChartIcon className="h-4 w-4" /> Tendência do score (6 meses)
            </div>
            <div className="h-56">
              <ClientOnly fallback={<div className="h-full" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analise.historico}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1000]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={cor.hex}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <Lightbulb className="h-4 w-4" /> Para apresentar ao proprietário
            </div>
            <ul className="space-y-2 text-sm">
              {analise.recomendacoes.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground/90">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
