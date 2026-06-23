import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCheck, X, Clock, Building2, User, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/app/admin/aprovacoes")({
  component: AdminAprovacoes,
});

interface PendingRegistration {
  id: string;
  email: string | null;
  nome: string | null;
  tipo_usuario: string | null;
  imobiliaria_nome: string | null;
  created_at: string;
}

function AdminAprovacoes() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadRegistrations() {
    setLoading(true);
    // pending_registrations não existe — pendentes são profiles com aprovado=false
    // e plano_pretendido != free (cadastros via plano pago aguardando revisão manual)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, tipo_usuario, imobiliaria_nome, created_at, tenant_id")
      .eq("aprovado", false)
      .not("plano_pretendido", "eq", "free")
      .not("plano_pretendido", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros pendentes.");
    } else {
      // Enrich with email from auth.users via tenant or profile id
      const rows: PendingRegistration[] = (data ?? []).map((p) => ({
        id: p.id,
        email: null, // email não disponível via RLS sem service_role
        nome: p.nome,
        tipo_usuario: p.tipo_usuario,
        imobiliaria_nome: p.imobiliaria_nome,
        created_at: p.created_at,
      }));
      setRegistrations(rows);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadRegistrations();
  }, []);

  async function handleApprove(reg: PendingRegistration) {
    setProcessing(reg.id);
    const { error } = await supabase
      .from("profiles")
      .update({ aprovado: true } as never)
      .eq("id", reg.id);

    if (error) {
      toast.error("Erro ao aprovar usuário.");
    } else {
      toast.success(`${reg.nome ?? reg.id} aprovado com sucesso.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    }
    setProcessing(null);
  }

  async function handleReject(reg: PendingRegistration) {
    setProcessing(reg.id);
    // Rejeição: marcar como aprovado=false e limpar plano_pretendido para free
    const { error } = await supabase
      .from("profiles")
      .update({ aprovado: false, plano_pretendido: "free" } as never)
      .eq("id", reg.id);

    if (error) {
      toast.error("Erro ao rejeitar usuário.");
    } else {
      toast.success(`${reg.nome ?? reg.id} rejeitado.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    }
    setProcessing(null);
  }

  const formattedDate = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Aprovações Pendentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Novos cadastros em planos pagos aguardando validação.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadRegistrations()}
          disabled={loading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-16 space-y-3 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm font-medium">Nenhum cadastro pendente no momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => (
            <div
              key={reg.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card gap-4 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {reg.tipo_usuario === "perfil-adm-imob" ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm truncate">
                      {reg.nome ?? reg.id}
                    </span>
                    {reg.tipo_usuario && (
                      <Badge variant="outline" className="text-[9px] uppercase font-bold shrink-0">
                        {reg.tipo_usuario}
                      </Badge>
                    )}
                  </div>
                  {reg.imobiliaria_nome && (
                    <p className="text-xs text-muted-foreground truncate">{reg.imobiliaria_nome}</p>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {formattedDate(reg.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                  disabled={processing === reg.id}
                  onClick={() => void handleReject(reg)}
                >
                  <X className="h-3 w-3" />
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  disabled={processing === reg.id}
                  onClick={() => void handleApprove(reg)}
                >
                  <UserCheck className="h-3 w-3" />
                  Aprovar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
