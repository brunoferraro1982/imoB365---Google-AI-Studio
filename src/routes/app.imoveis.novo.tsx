import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ChevronLeft, ImagePlus, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/ImovelForm";
import { FotosManager, type Foto } from "@/components/imoveis/FotosManager";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/imoveis/novo")({
  component: NovoImovel,
});

function NovoImovel() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  async function save(data: ImovelFormData, action: "save" | "publish" | "unpublish" = "save") {
    if (!tenantId || !user) {
      toast.error("Sua conta ainda não está vinculada a uma imobiliária.");
      return;
    }
    setSaving(true);
    const slug = data.slug || slugify(data.titulo);

    if (savedId) {
      const { error } = await supabase
        .from("imoveis")
        .update({
          ...data,
          finalidade: data.finalidade as "venda" | "aluguel" | "temporada",
          tipo: data.tipo as never,
          status: data.status as never,
          slug,
          publicado_em: data.publicado ? new Date().toISOString() : null,
        })
        .eq("id", savedId);
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return;
      }
      toast.success(action === "publish" ? "Imóvel publicado no site" : "Alterações salvas");
      return;
    }

    const { data: inserted, error } = await supabase
      .from("imoveis")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        ...data,
        finalidade: data.finalidade as "venda" | "aluguel" | "temporada",
        tipo: data.tipo as never,
        status: data.status as never,
        slug,
        publicado_em: data.publicado ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setSavedId(inserted!.id);
    toast.success("Imóvel criado! Adicione as fotos acima.");
  }

  async function loadFotos() {
    if (!savedId) return;
    const { data } = await supabase
      .from("imovel_fotos")
      .select("*")
      .eq("imovel_id", savedId)
      .order("ordem")
      .order("created_at");
    setFotos((data as Foto[]) ?? []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !tenantId || !savedId) return;
    setUploading(true);
    let nextOrdem = fotos.length;
    let hasCapa = fotos.some((f) => f.capa);
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const fname = `${crypto.randomUUID()}.${ext}`;
      const path = `${tenantId}/${savedId}/${fname}`;
      const { error: upErr } = await supabase.storage.from("imovel-fotos").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (upErr) {
        toast.error("Upload falhou: " + upErr.message);
        continue;
      }
      const { error: insErr } = await supabase.from("imovel_fotos").insert({
        imovel_id: savedId,
        tenant_id: tenantId,
        storage_path: path,
        ordem: nextOrdem++,
        capa: !hasCapa,
      });
      if (insErr) toast.error("Erro ao registrar foto: " + insErr.message);
      else hasCapa = true;
    }
    setUploading(false);
    loadFotos();
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/app/imoveis">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Novo imóvel</h1>

      {/* FOTOS — primeira seção da jornada */}
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            <Camera className="mr-2 inline h-5 w-5 text-primary" />
            Fotos do imóvel
          </h2>
          {savedId && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Enviando…" : "Adicionar fotos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
        {savedId ? (
          <FotosManager fotos={fotos} imovelId={savedId} onChange={loadFotos} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 text-center">
            <Camera className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Preencha os dados e salve o imóvel para adicionar fotos
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              Ir para o formulário
            </Button>
          </div>
        )}
      </section>

      {/* FORMULÁRIO */}
      <div ref={formRef}>
        <ImovelForm
          onSubmit={save}
          submitLabel={savedId ? "Salvar alterações" : "Criar imóvel"}
          submitting={saving}
          mode={savedId ? "edit" : "create"}
        />
      </div>

      {savedId && (
        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={() => navigate({ to: "/app/imoveis/$id", params: { id: savedId } })}
          >
            <Check className="mr-2 h-4 w-4" />
            Concluir cadastro
          </Button>
        </div>
      )}
    </div>
  );
}
