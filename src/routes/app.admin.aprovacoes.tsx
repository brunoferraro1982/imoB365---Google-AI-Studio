import { createFileRoute, redirect } from "@tanstack/react-router";
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
  user_id: string;
  email: string;
  nome: string | null;
  tipo_usuario: "corretor" | "imobiliaria";
  creci: string | null;
  cnpj: string | null;
  imobiliaria_nome: string | null;
  created_at: string;
}

function AdminAprovacoes() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadRegistrations() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pending_registrations")
      .select("*")
      .is("reviewed_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros pendentes.");
    } else {
      setRegistrations((data as PendingRegistration[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadRegistrations();
  }, []);

  async function handleApprove(reg: PendingRegistration) {
    setProcessing(reg.id);
    try {
      await supabase
        .from("profiles")
        .update({ status: "active", aprovado: true } as any)
        .eq("id", reg.user_id);

      await supabase
        .from("pending_registrations")
        .update({ reviewed_at: new Date().toISOString() })
        .eq("id", reg.id);

      toast.success(`${reg.nome ?? reg.email} aprovado com sucesso.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    } catch {
      toast.error("Erro ao aprovar usuário.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(reg: PendingRegistration) {
    setProcessing(reg.id);
    try {
      await supabase
        .from("profiles")
        .update({ status: "rejected" } as any)
        .eq("id", reg.user_id);

      await supabase
        .from("pending_registrations")
        .update({ reviewed_at: new Date().toISOString() })
        .eq("id", reg.id);

      toast.success(`${reg.nome ?? reg.email} rejeitado.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    } catch {
      toast.error("Erro ao rejeitar usuário.");
    } finally {
      setProcessing(null);
    }
  }

  const formattedDate = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Aprovações Pendentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Novos cadastros via rede social aguardando validação do admin.
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

      {/* Content */}
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
              {/* Left: user info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {reg.tipo_usuario === "imobiliaria" ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm truncate">
                      {reg.nome ?? reg.email}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] uppercase font-bold shrink-0"
                    >
                      {reg.tipo_usuario === "imobiliaria" ? "Imobiliária" : "Corretor"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{reg.email}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {reg.creci && (
                      <span className="text-[10px] text-muted-foreground">
                        CRECI: {reg.creci}
                      </span>
                    )}
                    {reg.imobiliaria_nome && (
                      <span className="text-[10px] text-muted-foreground">
                        {reg.imobiliaria_nome}
                      </span>
                    )}
                    {reg.cnpj && (
                      <span className="text-[10px] text-muted-foreground">
                        CNPJ: {reg.cnpj}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {formattedDate(reg.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
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
