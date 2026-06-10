import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/campos")({
  component: CamposPage,
});

const TIPOS = [
  { v: "texto", l: "Texto" },
  { v: "numero", l: "Número" },
  { v: "boolean", l: "Sim / Não" },
  { v: "select", l: "Seleção" },
  { v: "data", l: "Data" },
];

function CamposPage() {
  const { tenantId, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [opcoes, setOpcoes] = useState("");

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("tenant_custom_fields")
      .select("*")
      .eq("entidade", "imovel")
      .order("ordem")
      .order("created_at");
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  function slugify(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
  }

  async function add() {
    if (!tenantId || !rotulo) return;
    const chave = slugify(rotulo);
    if (!chave) return toast.error("Rótulo inválido");
    const opts =
      tipo === "select"
        ? opcoes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const { error } = await supabase.from("tenant_custom_fields").insert({
      tenant_id: tenantId,
      entidade: "imovel",
      chave,
      rotulo,
      tipo,
      opcoes: opts,
    });
    if (error) return toast.error(error.message);
    setRotulo("");
    setOpcoes("");
    setTipo("texto");
    toast.success("Campo criado");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir campo? Dados existentes em imóveis permanecem.")) return;
    await supabase.from("tenant_custom_fields").delete().eq("id", id);
    load();
  }

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Novo campo personalizado (Imóvel)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Adicione campos extras que aparecerão no cadastro de imóveis.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Rótulo</Label>
            <Input
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Ex.: Vista para o mar"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.v} value={t.v}>
                    {t.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipo === "select" && (
            <div>
              <Label>Opções (separadas por vírgula)</Label>
              <Input
                value={opcoes}
                onChange={(e) => setOpcoes(e.target.value)}
                placeholder="Opção 1, Opção 2"
              />
            </div>
          )}
        </div>
        <Button className="mt-4" onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Campos do imóvel</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Tag className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum campo personalizado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <div className="font-medium">{c.rotulo}</div>
                  <div className="text-xs text-muted-foreground">
                    chave <code className="rounded bg-muted px-1">{c.chave}</code>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {c.tipo}
                    </Badge>
                    {c.opcoes?.length ? <span className="ml-2">{c.opcoes.join(" · ")}</span> : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
