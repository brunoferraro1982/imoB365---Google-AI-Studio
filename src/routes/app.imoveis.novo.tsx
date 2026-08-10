import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ImagePlus, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/ImovelForm";
import { FotosManager, type Foto } from "@/components/imoveis/FotosManager";
import { aplicarMarcaDagua } from "@/lib/watermark";
import { comprimirImagem } from "@/lib/imageCompress";
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
  const [marcaDaguaAtiva, setMarcaDaguaAtiva] = useState(false);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("tenants")
      .select("tema")
      .eq("id", tenantId)
      .maybeSingle()
      .then(({ data: t }) => {
        setTenantLogoUrl((t?.tema as { logo_url?: string } | null)?.logo_url ?? null);
      });
  }, [tenantId]);

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
        } as any)
        .eq("id", savedId);
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return;
      }
      setMarcaDaguaAtiva(data.marca_dagua_ativa);
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
      } as any)
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setSavedId(inserted!.id);
    setMarcaDaguaAtiva(data.marca_dagua_ativa);
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
    setFotos((data as unknown as Foto[]) ?? []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !tenantId || !savedId) return;
    setUploading(true);

    // Nunca confia no toggle em memória do form (pode ter sido alterado mas
    // ainda não salvo) — sempre reconsulta o valor persistido no banco.
    const { data: imovelRow } = await (supabase as any)
      .from("imoveis")
      .select("marca_dagua_ativa")
      .eq("id", savedId)
      .maybeSingle();
    const marcaAtiva = !!imovelRow?.marca_dagua_ativa;
    if (marcaAtiva && !tenantLogoUrl) {
      toast.error(
        "Marca d'água ativada, mas nenhuma logo configurada em Site → Marca — fotos serão enviadas sem marca.",
      );
    }

    let nextOrdem = fotos.length;
    let hasCapa = fotos.some((f) => f.capa);
    for (const file of files) {
      // Comprime/redimensiona no cliente ANTES do upload — foto de celular crua
      // (>10MB) estourava o client_max_body_size do nginx e virava
      // "Failed to fetch". aplicarMarcaDagua já devolve WebP comprimido; o
      // caminho sem marca (e o original guardado) precisam ser comprimidos aqui.
      let uploadFile: File = await comprimirImagem(file);
      let originalFile: File | null = null;
      if (marcaAtiva && tenantLogoUrl) {
        const res = await aplicarMarcaDagua(file, tenantLogoUrl);
        if (res.watermarked) {
          uploadFile = res.file;
          originalFile = await comprimirImagem(file);
        }
      }

      const ext = uploadFile.name.split(".").pop() || "jpg";
      const path = `${tenantId}/${savedId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("imovel-fotos")
        .upload(path, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type,
        });
      if (upErr) {
        toast.error("Upload falhou: " + upErr.message);
        continue;
      }

      let originalPath: string | null = null;
      if (originalFile) {
        const origExt = originalFile.name.split(".").pop() || "jpg";
        const origPath = `${tenantId}/${savedId}/${crypto.randomUUID()}.${origExt}`;
        const { error: origErr } = await supabase.storage
          .from("imovel-fotos")
          .upload(origPath, originalFile, { cacheControl: "3600", contentType: originalFile.type });
        if (origErr) {
          await supabase.storage.from("imovel-fotos").remove([path]);
          toast.error("Upload do original falhou, foto não registrada: " + origErr.message);
          continue;
        }
        originalPath = origPath;
      }

      const { error: insErr } = await (supabase as any).from("imovel_fotos").insert({
        imovel_id: savedId,
        tenant_id: tenantId,
        storage_path: path,
        storage_path_original: originalPath,
        ordem: nextOrdem++,
        capa: !hasCapa,
      });
      if (insErr) {
        toast.error("Erro ao registrar foto: " + insErr.message);
        const toRemove = [path, ...(originalPath ? [originalPath] : [])];
        await supabase.storage.from("imovel-fotos").remove(toRemove);
      } else {
        hasCapa = true;
      }
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
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Novo imóvel</h1>
      <p className="mb-6 text-sm text-muted-foreground">Cadastre imóveis para venda e locação</p>

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
          <FotosManager
            fotos={fotos}
            imovelId={savedId}
            tenantId={tenantId ?? ""}
            marcaDaguaAtiva={marcaDaguaAtiva}
            logoUrl={tenantLogoUrl}
            onChange={loadFotos}
          />
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
