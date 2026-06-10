import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/notificacoes")({
  component: NotificacoesPage,
});

type Prefs = {
  email_novo_lead: boolean;
  email_visita: boolean;
  email_contrato: boolean;
  email_comissao: boolean;
  inapp_novo_lead: boolean;
  inapp_visita: boolean;
};

const DEFAULTS: Prefs = {
  email_novo_lead: true,
  email_visita: true,
  email_contrato: true,
  email_comissao: true,
  inapp_novo_lead: true,
  inapp_visita: true,
};

const LABELS: Record<keyof Prefs, string> = {
  email_novo_lead: "E-mail · novo lead",
  email_visita: "E-mail · visitas",
  email_contrato: "E-mail · contratos",
  email_comissao: "E-mail · comissões",
  inapp_novo_lead: "In-app · novo lead",
  inapp_visita: "In-app · visitas",
};

function NotificacoesPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs({ ...DEFAULTS, ...data });
      });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: user.id, ...prefs });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferências salvas");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notificações</h2>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-6">
        {(Object.keys(LABELS) as (keyof Prefs)[]).map((k) => (
          <label key={k} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span>{LABELS[k]}</span>
            <Switch checked={prefs[k]} onCheckedChange={(v) => setPrefs({ ...prefs, [k]: v })} />
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Salvar preferências"}
      </Button>
    </div>
  );
}
