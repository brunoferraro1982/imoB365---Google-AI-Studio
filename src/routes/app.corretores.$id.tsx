import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CorretorForm, type CorretorFormData } from "@/components/corretores/CorretorForm";
import { slugify } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/corretores/$id")({
  component: EditarCorretor,
});

function EditarCorretor() {
  const { id } = Route.useParams();
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [initial, setInitial] = useState<Partial<CorretorFormData> | null>(null);
  const [slug, setSlug] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("corretores")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Corretor não encontrado");
      setLoading(false);
      return;
    }
    setSlug(data.slug);
    setFotoUrl(data.foto_url);
    setInitial({
      nome: data.nome,
      email: data.email ?? "",
      telefone: data.telefone ?? "",
      whatsapp: data.whatsapp ?? "",
      creci: data.creci ?? "",
      creci_uf: data.creci_uf ?? "",
      cargo: data.cargo ?? "",
      bio: data.bio ?? "",
      slug: data.slug,
      comissao_padrao: data.comissao_padrao,
      ativo: data.ativo,
      publico: data.publico,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save(data: CorretorFormData) {
    setSaving(true);
    const newSlug = data.slug || slugify(data.nome);
    const { error } = await (supabase as any)
      .from("corretores")
      .update({ ...data, slug: newSlug })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setSlug(newSlug);
    toast.success("Alterações salvas");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !tenantId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${tenantId}/${id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("corretor-fotos").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      toast.error("Upload falhou: " + upErr.message);
      setUploading(false);
      return;
    }
    const url = supabase.storage.from("corretor-fotos").getPublicUrl(path).data.publicUrl;
    if (fotoUrl) {
      const oldPath = fotoUrl.split("/corretor-fotos/")[1];
      if (oldPath) await supabase.storage.from("corretor-fotos").remove([oldPath]);
    }
    const { error } = await (supabase as any)
      .from("corretores")
      .update({ foto_url: url })
      .eq("id", id);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFotoUrl(url);
    toast.success("Foto atualizada");
  }

  async function removeFoto() {
    if (!fotoUrl || !(await confirmDialog("Remover a foto?"))) return;
    const oldPath = fotoUrl.split("/corretor-fotos/")[1];
    if (oldPath) await supabase.storage.from("corretor-fotos").remove([oldPath]);
    await (supabase as any).from("corretores").update({ foto_url: null }).eq("id", id);
    setFotoUrl(null);
    toast.success("Foto removida");
  }

  if (loading || !initial)
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/corretores">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        {slug && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/corretor/${slug}`} target="_blank" rel="noreferrer">
              Ver no site <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{initial.nome}</h1>

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Foto</h2>
        <div className="flex items-center gap-6">
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-xl font-medium text-muted-foreground">
              {(initial.nome ?? "")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
          )}
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Enviando…" : fotoUrl ? "Trocar foto" : "Enviar foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            {fotoUrl && (
              <Button variant="outline" size="sm" onClick={removeFoto}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <CorretorForm
        initial={initial}
        onSubmit={save}
        submitLabel="Salvar alterações"
        submitting={saving}
      />
      <ConfirmDialog />
    </div>
  );
}
