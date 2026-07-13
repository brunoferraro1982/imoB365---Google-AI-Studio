import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Webhook, Eye, EyeOff, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/configuracoes/webhooks")({
  component: WebhooksPage,
});

const EVENTS = [
  "lead.created",
  "lead.atribuido",
  "lead.convertido",
  "imovel.publicado",
  "contrato.assinado",
  "contrato.ativo",
];

const EVENT_LABEL: Record<string, string> = {
  "lead.created": "Novo lead criado",
  "lead.atribuido": "Lead atribuído a um corretor",
  "lead.convertido": "Lead convertido em negócio",
  "imovel.publicado": "Imóvel publicado",
  "contrato.assinado": "Contrato assinado",
  "contrato.ativo": "Contrato ativado",
};

const DELIVERY_STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  entregue: { label: "Entregue", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  tentando: { label: "Tentando novamente", variant: "secondary" },
  falhou: { label: "Falhou", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

function WebhooksPage() {
  const { tenantId, isAdmin, isSuperAdmin, roles } = useAuth();
  const podeGerenciar = isAdmin || isSuperAdmin || roles.includes("broker");
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<string[]>(["lead.created"]);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [deliveries, setDeliveries] = useState<any[]>([]);

  async function load() {
    if (!tenantId) return;
    const [{ data }, { data: dl }] = await Promise.all([
      supabase.from("tenant_webhooks").select("*").order("created_at", { ascending: false }),
      supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setItems(data ?? []);
    setDeliveries(dl ?? []);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function add() {
    if (!tenantId || !nome || !url) return;
    const { error } = await supabase
      .from("tenant_webhooks")
      .insert({ tenant_id: tenantId, nome, url, eventos });
    if (error) return toast.error(error.message);
    setNome("");
    setUrl("");
    setEventos(["lead.created"]);
    toast.success("Webhook criado");
    load();
  }
  async function toggle(id: string, ativo: boolean) {
    await supabase.from("tenant_webhooks").update({ ativo }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Excluir webhook?"))) return;
    await supabase.from("tenant_webhooks").delete().eq("id", id);
    load();
  }

  if (!podeGerenciar)
    return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Novo webhook</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Receba eventos do imob365 em sua URL. Cada entrega inclui o header{" "}
          <code className="rounded bg-muted px-1">X-Imob365-Signature</code>.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Zapier / N8N"
            />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="mt-4">
          <Label>Eventos</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {EVENTS.map((e) => {
              const on = eventos.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEventos((s) => (on ? s.filter((x) => x !== e) : [...s, e]))}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {EVENT_LABEL[e] ?? e}
                </button>
              );
            })}
          </div>
        </div>
        <Button className="mt-4" onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Webhooks configurados</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Webhook className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum webhook ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((w) => (
              <div
                key={w.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{w.nome}</div>
                    <Badge variant={w.ativo ? "default" : "outline"}>
                      {w.ativo ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{w.url}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(w.eventos ?? []).map((e: string) => (
                      <Badge key={e} variant="secondary" className="text-[10px]">
                        {EVENT_LABEL[e] ?? e}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    Secret:{" "}
                    <code className="rounded bg-muted px-1">
                      {showSecret[w.id] ? w.secret : "••••••••••••••••"}
                    </code>
                    <button
                      type="button"
                      onClick={() => setShowSecret((s) => ({ ...s, [w.id]: !s[w.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showSecret[w.id] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={w.ativo} onCheckedChange={(v) => toggle(w.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => remove(w.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <History className="h-4 w-4" /> Últimas entregas
        </h2>
        {deliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deliveries.map((d) => {
              const status = DELIVERY_STATUS_LABEL[d.status] ?? {
                label: d.status,
                variant: "outline" as const,
              };
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{EVENT_LABEL[d.evento] ?? d.evento}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </span>
                    {d.last_error && (
                      <div className="mt-1 truncate text-destructive">{d.last_error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.response_status && (
                      <span className="text-muted-foreground">HTTP {d.response_status}</span>
                    )}
                    <Badge variant={status.variant} className="text-[10px]">
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog />
    </div>
  );
}
