import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Download, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes/privacidade")({
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function exportar() {
    if (!user) return;
    setExporting(true);
    try {
      const tables = [
        "profiles",
        "leads",
        "lead_interacoes",
        "lead_mensagens",
        "notifications",
        "notification_prefs",
      ];
      const dump: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
      };
      for (const t of tables) {
        const q = (supabase as any).from(t).select("*");
        const { data } =
          t === "profiles" || t === "notification_prefs"
            ? await q.eq(t === "profiles" ? "id" : "user_id", user.id)
            : await q;
        dump[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function excluir() {
    if (!user || confirm !== "EXCLUIR") return;
    setDeleting(true);
    try {
      // Anonimiza dados pessoais nas tabelas com RLS do próprio usuário
      await (supabase as any)
        .from("profiles")
        .update({ nome: "Usuário removido", telefone: null, avatar_url: null })
        .eq("id", user.id);
      await (supabase as any).from("notifications").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
      toast.success("Conta encerrada. Solicite a exclusão completa pelo suporte.");
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">Direitos do titular (LGPD)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Você pode exportar uma cópia dos seus dados pessoais ou solicitar a exclusão da sua
              conta a qualquer momento, conforme a Lei Geral de Proteção de Dados.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Exportar meus dados</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe um arquivo JSON com seu perfil, leads, mensagens, notificações e interações.
        </p>
        <Button className="mt-4" onClick={exportar} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" /> {exporting ? "Exportando…" : "Exportar JSON"}
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold text-destructive">Encerrar conta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta ação anonimiza seu perfil e desconecta sua sessão. Para exclusão definitiva dos
          registros, fale com o suporte.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Input
            placeholder="Digite EXCLUIR para confirmar"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            onClick={excluir}
            disabled={confirm !== "EXCLUIR" || deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Encerrando…" : "Encerrar conta"}
          </Button>
        </div>
      </section>
    </div>
  );
}
