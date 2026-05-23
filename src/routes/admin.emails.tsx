import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/emails")({
  component: EmailCenter,
});

type Log = {
  id: string;
  created_at: string;
  template_name: string;
  recipient_email: string;
  status: string;
  message_id: string | null;
  error_message: string | null;
};

type Supp = {
  id: string;
  created_at: string;
  email: string;
  reason: string;
};

function EmailCenter() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [supp, setSupp] = useState<Supp[]>([]);
  const [counts, setCounts] = useState({ enviados: 0, falhas: 0, suprimidos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: l }, { data: s }] = await Promise.all([
        supabase.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("suppressed_emails").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      const logs = (l as Log[]) ?? [];
      setLogs(logs);
      setSupp((s as Supp[]) ?? []);
      setCounts({
        enviados: logs.filter((r) => r.status === "sent").length,
        falhas: logs.filter((r) => r.status !== "sent").length,
        suprimidos: (s ?? []).length,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de e-mails</h1>
          <p className="text-sm text-muted-foreground">Envios, falhas e supressões de notify.imob365.com.br.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card label="Enviados (recentes)" value={counts.enviados} icon={CheckCircle2} tone="text-emerald-600" />
        <Card label="Com falha" value={counts.falhas} icon={AlertTriangle} tone="text-amber-600" />
        <Card label="Endereços suprimidos" value={counts.suprimidos} icon={ShieldAlert} tone="text-rose-600" />
      </div>

      <Tabs defaultValue="logs" className="mt-8">
        <TabsList>
          <TabsTrigger value="logs">Logs de envio</TabsTrigger>
          <TabsTrigger value="supp">Supressões</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Template</th>
                  <th className="px-4 py-2">Destinatário</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Erro</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Carregando…</td></tr>}
                {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum envio ainda.</td></tr>}
                {logs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{r.template_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.recipient_email}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{r.status}</Badge></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="supp">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">E-mail</th>
                  <th className="px-4 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {supp.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">Nenhum endereço suprimido.</td></tr>}
                {supp.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.email}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{s.reason}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
    </div>
  );
}