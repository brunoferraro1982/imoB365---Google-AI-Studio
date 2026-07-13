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
  const { tenantId, isAdmin, isSuperAdmin, roles, user } = useAuth();
  const podeGerenciar = isAdmin || isSuperAdmin || roles.includes("broker");
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

  if (!podeGerenciar)
    return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

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

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Endpoints disponíveis</h3>
        <p className="text-sm text-muted-foreground">
          Todas as chamadas exigem o header <code className="rounded bg-muted px-1">X-Api-Key</code>{" "}
          com uma das chaves acima. Apenas dados do imóvel/lead do seu próprio tenant são
          retornados/afetados.
        </p>

        <div className="rounded-xl border border-border bg-card p-5">
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold">
            GET /api/public/v1/imoveis
          </code>
          <p className="mt-2 text-sm text-muted-foreground">
            Lista imóveis publicados e ativos do tenant, paginado.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Parâmetros de busca (query string)
              </div>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {[
                    ["limit", "número, máx. 100 (padrão 20)"],
                    ["offset", "número (padrão 0)"],
                    ["finalidade", '"venda" ou "aluguel"'],
                    ["cidade", "texto (busca parcial)"],
                  ].map(([f, d]) => (
                    <tr key={f} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-mono">{f}</td>
                      <td className="py-1 text-muted-foreground">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Campos retornados (por imóvel)
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                id, slug, titulo, descricao, tipo, finalidade, preco, quartos, banheiros, vagas,
                area_util, endereco_cidade, endereco_uf, endereco_bairro, publicado_em
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Envelope da resposta: <code>{"{ data: [...], total, limit, offset }"}</code>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold">
            GET /api/public/v1/imoveis/:slug
          </code>
          <p className="mt-2 text-sm text-muted-foreground">
            Detalhes completos de um imóvel publicado pelo slug.
          </p>
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Campos retornados
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
              id, slug, titulo, descricao, tipo, finalidade, preco, condominio, iptu, area_util,
              area_total, quartos, suites, banheiros, vagas, endereco_logradouro, endereco_numero,
              endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, latitude, longitude,
              caracteristicas, publicado_em, fotos (array de URLs)
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Envelope da resposta: <code>{"{ data: {...} }"}</code>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold">
            POST /api/public/v1/leads
          </code>
          <p className="mt-2 text-sm text-muted-foreground">
            Cria um novo lead vinculado ao tenant da chave usada.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Campos aceitos (corpo JSON)
              </div>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {[
                    ["nome", "texto, obrigatório (máx. 200)"],
                    ["email", "texto (máx. 200)"],
                    ["telefone", "texto (máx. 50)"],
                    ["mensagem", "texto (máx. 2000)"],
                    ["imovel_id", "uuid do imóvel relacionado"],
                  ].map(([f, d]) => (
                    <tr key={f} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-mono">{f}</td>
                      <td className="py-1 text-muted-foreground">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Resposta</div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                201 · {"{ id }"} — id do lead criado (origem é sempre gravada como "api")
              </p>
            </div>
          </div>
        </div>
      </section>
      <ConfirmDialog />
    </div>
  );
}
