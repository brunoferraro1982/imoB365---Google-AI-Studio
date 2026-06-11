import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Key, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/configuracoes/api")({
  component: ApiKeysPage,
});

function genKey() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `imob_${hex}`;
}
async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ApiKeysPage() {
  const { tenantId, isAdmin, user } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("tenant_api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function create() {
    if (!tenantId || !nome.trim()) return;
    const key = genKey();
    const hash = await sha256Hex(key);
    const { error } = await supabase.from("tenant_api_keys").insert({
      tenant_id: tenantId,
      nome: nome.trim(),
      key_prefix: key.slice(0, 12),
      key_hash: hash,
      scopes: ["read"],
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setNewKey(key);
    setNome("");
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Revogar esta chave?"))) return;
    await supabase.from("tenant_api_keys").delete().eq("id", id);
    load();
  }

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Nova chave de API</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Use em integrações externas. Envie no header{" "}
          <code className="rounded bg-muted px-1">X-Api-Key</code>.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Nome (ex.: site institucional)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Button onClick={create}>
            <Plus className="mr-2 h-4 w-4" /> Gerar
          </Button>
        </div>
        {newKey && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <Label className="text-amber-900 dark:text-amber-200">
              Copie agora — não mostraremos novamente
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">
                {newKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success("Copiado");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Chaves ativas</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Key className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma chave criada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((k) => (
              <div
                key={k.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{k.nome}</div>
                    <Badge variant={k.ativo ? "default" : "outline"}>
                      {k.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {k.key_prefix}…
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Criada em {new Date(k.created_at).toLocaleDateString("pt-BR")}
                    {k.last_used_at &&
                      ` · último uso ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(k.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/30 p-6">
        <h3 className="text-sm font-semibold">Endpoints disponíveis</h3>
        <ul className="mt-3 space-y-2 font-mono text-xs">
          <li>
            <code className="rounded bg-background px-2 py-1">GET /api/public/v1/imoveis</code> —
            listar imóveis publicados
          </li>
          <li>
            <code className="rounded bg-background px-2 py-1">
              GET /api/public/v1/imoveis/:slug
            </code>{" "}
            — detalhes
          </li>
          <li>
            <code className="rounded bg-background px-2 py-1">POST /api/public/v1/leads</code> —
            criar lead
          </li>
        </ul>
      </section>
      <ConfirmDialog />
    </div>
  );
}
