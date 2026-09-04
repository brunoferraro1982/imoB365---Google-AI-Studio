import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building2, Pencil, Copy, Trash2, GitCompare, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL, slugify, FINALIDADE_LABEL, STATUS_LABEL, TIPO_LABEL } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/imoveis/")({
  component: ImoveisList,
});

type Imovel = {
  id: string;
  titulo: string;
  codigo_interno: string | null;
  finalidade: string;
  tipo: string;
  status: string;
  preco: number;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  publicado: boolean;
  updated_at: string;
};

function ImoveisList() {
  const [items, setItems] = useState<Imovel[]>([]);
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("imoveis")
      .select(
        "id,titulo,codigo_interno,finalidade,tipo,status,preco,endereco_cidade,endereco_uf,publicado,updated_at",
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar imóveis: " + error.message);
    setItems((data as Imovel[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este imóvel? Esta ação não pode ser desfeita."))) return;
    const { error } = await supabase
      .from("imoveis")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId ?? "");
    if (error) return toast.error(error.message);
    toast.success("Imóvel excluído");
    load();
  }

  // Duplica o imóvel como um novo rascunho (não publicado) no mesmo tenant —
  // reaproveita as fotos originais apontando pro mesmo storage_path (a
  // política de leitura do bucket não restringe por pasta, só por
  // bucket_id, então não é preciso copiar o arquivo em si).
  async function duplicar(id: string) {
    if (!tenantId) return;
    setDuplicandoId(id);
    try {
      const { data: original, error: fetchError } = await supabase
        .from("imoveis")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (fetchError || !original) {
        toast.error(fetchError?.message ?? "Imóvel não encontrado");
        return;
      }

      const {
        id: _id,
        slug: _slug,
        titulo: _titulo,
        codigo_interno: _codigoInterno,
        status: _status,
        publicado: _publicado,
        publicado_em: _publicadoEm,
        destaque: _destaque,
        created_at: _createdAt,
        updated_at: _updatedAt,
        created_by: _createdBy,
        ...resto
      } = original;

      const novoTitulo = `${original.titulo} (cópia)`;
      const novoSlug = `${slugify(novoTitulo)}-${crypto.randomUUID().slice(0, 6)}`;

      const { data: novo, error: insertError } = await supabase
        .from("imoveis")
        .insert({
          ...resto,
          tenant_id: tenantId,
          titulo: novoTitulo,
          slug: novoSlug,
          codigo_interno: null,
          status: "rascunho",
          publicado: false,
          publicado_em: null,
          destaque: false,
        })
        .select("id")
        .single();
      if (insertError || !novo) {
        toast.error(insertError?.message ?? "Erro ao duplicar imóvel");
        return;
      }

      const { data: fotos } = await supabase
        .from("imovel_fotos")
        .select("storage_path,ordem,capa,legenda")
        .eq("imovel_id", id);
      if (fotos && fotos.length > 0) {
        const { error: fotosError } = await supabase.from("imovel_fotos").insert(
          fotos.map((f) => ({
            imovel_id: novo.id,
            tenant_id: tenantId,
            storage_path: f.storage_path,
            ordem: f.ordem,
            capa: f.capa,
            legenda: f.legenda,
          })),
        );
        if (fotosError) {
          toast.error("Imóvel duplicado, mas houve um erro ao copiar as fotos.");
        }
      }

      toast.success("Imóvel duplicado como rascunho — edite e publique quando quiser.");
      load();
    } finally {
      setDuplicandoId(null);
    }
  }

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.titulo.toLowerCase().includes(q) ||
      (i.codigo_interno ?? "").toLowerCase().includes(q) ||
      (i.endereco_cidade ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catálogo da sua imobiliária</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/imoveis/comparar">
              <GitCompare className="mr-2 h-4 w-4" /> Comparar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/imoveis/assistente">
              <Wand2 className="mr-2 h-4 w-4" /> Cadastrar com assistente
            </Link>
          </Button>
          <Button asChild>
            <Link to="/app/imoveis/novo">
              <Plus className="mr-2 h-4 w-4" /> Novo imóvel
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Input
          placeholder="Buscar por título, código ou cidade…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum imóvel cadastrado ainda."
                : "Nenhum resultado para a busca."}
            </p>
            {items.length === 0 && (
              <Button asChild size="sm">
                <Link to="/app/imoveis/novo">Cadastrar primeiro imóvel</Link>
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Imóvel</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Finalidade</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/imoveis/$id"
                      params={{ id: i.id }}
                      className="font-medium hover:text-primary"
                    >
                      {i.titulo}
                    </Link>
                    {i.codigo_interno && (
                      <div className="text-xs text-muted-foreground">#{i.codigo_interno}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {TIPO_LABEL[i.tipo] ?? i.tipo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {i.endereco_cidade
                      ? `${i.endereco_cidade}${i.endereco_uf ? "/" + i.endereco_uf : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatBRL(i.preco)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.publicado && i.status === "ativo" ? "default" : "secondary"}>
                      {STATUS_LABEL[i.status] ?? i.status}
                      {i.publicado && i.status === "ativo" ? " · publicado" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild title="Editar">
                        <Link to="/app/imoveis/$id" params={{ id: i.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Duplicar anúncio"
                        disabled={duplicandoId === i.id}
                        onClick={() => duplicar(i.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => remove(i.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}
