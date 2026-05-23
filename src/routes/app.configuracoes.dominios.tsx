import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Globe, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/dominios")({
  component: DominiosPage,
});

function DominiosPage() {
  const { tenantId, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [dominio, setDominio] = useState("");

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase.from("tenant_domains").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function add() {
    if (!tenantId || !dominio) return;
    const clean = dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return toast.error("Domínio inválido");
    const { error } = await supabase.from("tenant_domains").insert({ tenant_id: tenantId, dominio: clean });
    if (error) return toast.error(error.message);
    setDominio("");
    toast.success("Domínio adicionado");
    load();
  }

  async function tornarPrimario(id: string) {
    if (!tenantId) return;
    await supabase.from("tenant_domains").update({ primario: false }).eq("tenant_id", tenantId);
    await supabase.from("tenant_domains").update({ primario: true }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir domínio?")) return;
    await supabase.from("tenant_domains").delete().eq("id", id);
    load();
  }

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Adicionar domínio próprio</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Aponte um <code className="rounded bg-muted px-1">CNAME</code> para <code className="rounded bg-muted px-1">app.imob365.com.br</code> e
          adicione o registro <code className="rounded bg-muted px-1">TXT</code> de verificação gerado abaixo.
        </p>
        <div className="flex gap-2">
          <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="www.suaimobiliaria.com.br" />
          <Button onClick={add}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Domínios configurados</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Globe className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum domínio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{d.dominio}</div>
                      {d.primario && <Badge>Primário</Badge>}
                      {d.verificado
                        ? <Badge variant="default" className="bg-emerald-600"><Check className="mr-1 h-3 w-3" /> Verificado</Badge>
                        : <Badge variant="outline"><X className="mr-1 h-3 w-3" /> Pendente</Badge>}
                    </div>
                    {!d.verificado && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Adicione o registro TXT <code className="rounded bg-muted px-1">imob365-verify={d.verification_token}</code> em <code className="rounded bg-muted px-1">_imob365.{d.dominio}</code>.
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.verificado && !d.primario && (
                      <Button variant="outline" size="sm" onClick={() => tornarPrimario(d.id)}>Tornar primário</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}