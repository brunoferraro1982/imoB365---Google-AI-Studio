import { useEffect, useState, type DragEvent } from "react";
import { ImagePlus, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FotosManager, type Foto } from "@/components/imoveis/FotosManager";
import { aplicarMarcaDagua } from "@/lib/watermark";
import { comprimirImagem } from "@/lib/imageCompress";
import { toast } from "sonner";

export function ImovelFotosSection({
  imovelId,
  tenantId,
}: {
  imovelId: string | null;
  tenantId: string | null | undefined;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [marcaDaguaAtiva, setMarcaDaguaAtiva] = useState(false);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);

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

  async function loadFotos() {
    if (!imovelId) return;
    const [{ data }, { data: imovelRow }] = await Promise.all([
      supabase
        .from("imovel_fotos")
        .select("*")
        .eq("imovel_id", imovelId)
        .order("ordem")
        .order("created_at"),
      (supabase as any)
        .from("imoveis")
        .select("marca_dagua_ativa")
        .eq("id", imovelId)
        .maybeSingle(),
    ]);
    setFotos((data as unknown as Foto[]) ?? []);
    setMarcaDaguaAtiva(!!imovelRow?.marca_dagua_ativa);
  }

  useEffect(() => {
    loadFotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelId]);

  async function uploadFiles(files: File[]) {
    if (!files.length || !tenantId || !imovelId) return;
    setUploading(true);

    // Nunca confia no toggle em memória do form (pode ter sido alterado mas
    // ainda não salvo) — sempre reconsulta o valor persistido no banco.
    const { data: imovelRow } = await (supabase as any)
      .from("imoveis")
      .select("marca_dagua_ativa")
      .eq("id", imovelId)
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
      const path = `${tenantId}/${imovelId}/${crypto.randomUUID()}.${ext}`;
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
        const origPath = `${tenantId}/${imovelId}/${crypto.randomUUID()}.${origExt}`;
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
        imovel_id: imovelId,
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

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    uploadFiles(files);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/"));
    uploadFiles(files);
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          <Camera className="mr-2 inline h-5 w-5 text-primary" />
          Fotos do imóvel
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Enviando…" : "Adicionar fotos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading || !imovelId}
          />
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-4 rounded-lg border-2 border-dashed py-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <Camera className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {uploading ? "Enviando fotos…" : "Arraste fotos aqui ou use o botão acima"}
        </p>
      </div>

      <FotosManager
        fotos={fotos}
        imovelId={imovelId ?? ""}
        tenantId={tenantId ?? ""}
        marcaDaguaAtiva={marcaDaguaAtiva}
        logoUrl={tenantLogoUrl}
        onChange={loadFotos}
      />
    </section>
  );
}
