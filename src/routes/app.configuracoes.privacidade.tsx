import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, ShieldCheck, FileSearch, Eraser, Mail, BarChart3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/privacidade")({
  component: PrivacidadePage,
});

type ConsentRecord = { type: string; granted: boolean; granted_at: string | null; revoked_at: string | null };
type DSR = { id: string; type: string; status: string; notes: string | null; created_at: string; completed_at: string | null };

const DSR_TYPES: { id: string; label: string; desc: string }[] = [
  { id: "access",      label: "Acesso aos meus dados",  desc: "Solicitar relatório de todos os dados pessoais que possuímos" },
  { id: "erasure",     label: "Eliminação dos dados",   desc: "Solicitar a exclusão definitiva dos seus dados pessoais" },
  { id: "portability", label: "Portabilidade",          desc: "Receber seus dados em formato estruturado e portável" },
  { id: "correction",  label: "Correção de dados",      desc: "Solicitar correção de dados incompletos ou incorretos" },
  { id: "objection",   label: "Oposição ao tratamento", desc: "Opor-se a determinada finalidade de tratamento dos seus dados" },
];

const CONSENT_LABELS: Record<string, { label: string; icon: typeof Mail; desc: string }> = {
  cookies_analytics: { label: "Cookies analíticos",  icon: BarChart3, desc: "Rastreamento de navegação para métricas de uso da plataforma" },
  marketing_email:   { label: "E-mails de marketing", icon: Mail,      desc: "Receber novidades, promoções e comunicações da imob365"      },
  data_processing:   { label: "Tratamento de dados",  icon: ShieldCheck, desc: "Processamento de dados para operação dos serviços contratados (obrigatório)" },
};

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700 border-amber-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  completed:  "bg-green-100 text-green-700 border-green-200",
  rejected:   "bg-red-100 text-red-700 border-red-200",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", processing: "Em análise", completed: "Concluído", rejected: "Recusado",
};

function PrivacidadePage() {
  const { user } = useAuth();
  const [consents, setConsents]   = useState<ConsentRecord[]>([]);
  const [requests, setRequests]   = useState<DSR[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirmDel, setConfirmDel] = useState("");
  const [submitting, setSubmitting] = useState("");
  const [savingConsent, setSavingConsent] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("consent_records").select("type,granted,granted_at,revoked_at").eq("user_id", user.id),
      supabase.from("data_subject_requests").select("id,type,status,notes,created_at,completed_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([{ data: c }, { data: r }]) => {
      setConsents((c as ConsentRecord[]) ?? []);
      setRequests((r as DSR[]) ?? []);
    });
  }, [user]);

  function consentState(type: string) {
    return consents.find((c) => c.type === type)?.granted ?? false;
  }

  async function toggleConsent(type: string) {
    const newVal = !consentState(type);
    setSavingConsent(type);
    const { error } = await supabase.rpc("set_consent", { p_type: type, p_granted: newVal });
    if (error) { toast.error("Erro ao salvar consentimento"); }
    else {
      setConsents((prev) => {
        const filtered = prev.filter((c) => c.type !== type);
        return [...filtered, { type, granted: newVal, granted_at: newVal ? new Date().toISOString() : null, revoked_at: !newVal ? new Date().toISOString() : null }];
      });
      toast.success(newVal ? "Consentimento registrado" : "Consentimento revogado");
    }
    setSavingConsent("");
  }

  async function exportar() {
    if (!user) return;
    setExporting(true);
    try {
      const tables: Array<[string, string, string]> = [
        ["profiles",         "id",      user.id],
        ["notifications",    "user_id", user.id],
        ["notification_prefs", "user_id", user.id],
        ["consent_records",  "user_id", user.id],
        ["data_subject_requests", "user_id", user.id],
      ];
      const dump: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
      };
      for (const [table, col, val] of tables) {
        const { data } = await (supabase as any).from(table).select("*").eq(col, val);
        dump[table] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `meus-dados-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function submitRequest(type: string) {
    setSubmitting(type);
    const { error } = await supabase.rpc("submit_lgpd_request", { p_type: type, p_notes: null });
    if (error) { toast.error(`Erro: ${error.message}`); }
    else {
      toast.success("Solicitação registrada. Responderemos em até 15 dias.");
      const { data } = await supabase
        .from("data_subject_requests")
        .select("id,type,status,notes,created_at,completed_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setRequests((data as DSR[]) ?? []);
    }
    setSubmitting("");
  }

  async function encerrarConta() {
    if (!user || confirmDel !== "EXCLUIR") return;
    const { error } = await supabase.rpc("submit_lgpd_request", { p_type: "erasure", p_notes: "Auto-solicitação de encerramento de conta" });
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    await supabase.auth.signOut();
    toast.success("Solicitação de erasure registrada. Você será contatado em até 15 dias.");
    window.location.href = "/";
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Cabeçalho */}
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Privacidade & LGPD</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie seus consentimentos e exerça seus direitos como titular de dados, conforme a
              Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </div>
        </div>
      </section>

      {/* Gerenciamento de consentimentos */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Meus consentimentos</h3>
        <div className="space-y-3">
          {Object.entries(CONSENT_LABELS).map(([type, meta]) => {
            const Icon = meta.icon;
            const granted = consentState(type);
            const isDataProcessing = type === "data_processing";
            return (
              <div key={type} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                  </div>
                </div>
                <button
                  disabled={isDataProcessing || savingConsent === type}
                  onClick={() => !isDataProcessing && toggleConsent(type)}
                  className={[
                    "flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors",
                    granted ? "bg-primary border-primary" : "bg-muted border-border",
                    isDataProcessing ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  title={isDataProcessing ? "Obrigatório para operação do serviço" : undefined}
                >
                  <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${granted ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Exportar dados */}
      <section className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Exportar meus dados</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe um arquivo JSON com seu perfil, consentimentos e solicitações registradas.
        </p>
        <Button className="mt-4" onClick={exportar} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" /> {exporting ? "Exportando…" : "Exportar JSON"}
        </Button>
      </section>

      {/* Solicitações LGPD */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Exercer direitos de titular (Art. 18 LGPD)</h3>
        <p className="text-sm text-muted-foreground">
          Respondemos em até 15 dias corridos. Suas solicitações ficam registradas abaixo.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DSR_TYPES.map((t) => (
            <button
              key={t.id}
              disabled={submitting === t.id}
              onClick={() => submitRequest(t.id)}
              className="flex flex-col items-start rounded-lg border p-3 text-left hover:bg-muted/30 transition disabled:opacity-50 disabled:cursor-wait"
            >
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Histórico */}
        {requests.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Histórico de solicitações</p>
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{DSR_TYPES.find((t) => t.id === r.type)?.label ?? r.type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[r.status] ?? ""}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Encerrar conta */}
      <section className="rounded-xl border border-red-200 bg-red-50/30 p-6">
        <h3 className="font-semibold text-red-700">Encerrar conta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra uma solicitação de eliminação de dados (LGPD Art. 18, VI). Sua sessão será encerrada
          e nosso DPO processará a exclusão em até 15 dias.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Input
            placeholder="Digite EXCLUIR para confirmar"
            value={confirmDel}
            onChange={(e) => setConfirmDel(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            onClick={encerrarConta}
            disabled={confirmDel !== "EXCLUIR"}
          >
            Encerrar conta
          </Button>
        </div>
      </section>
    </div>
  );
}
