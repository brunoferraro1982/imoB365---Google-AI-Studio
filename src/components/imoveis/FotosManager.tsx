import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, Trash2, GripVertical, Droplets, DropletOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { imovelFotoUrl } from "@/lib/format";
import { aplicarMarcaDagua } from "@/lib/watermark";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export type Foto = {
  id: string;
  storage_path: string;
  storage_path_original: string | null;
  capa: boolean;
  ordem: number;
};

const publicUrl = imovelFotoUrl;
const BUCKET = "imovel-fotos";

function SortableItem({
  foto,
  onCapa,
  onDelete,
}: {
  foto: Foto;
  onCapa: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: foto.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const temMarca = !!foto.storage_path_original;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-lg border border-border bg-card"
    >
      <img
        src={publicUrl(foto.storage_path)}
        alt=""
        className="aspect-square w-full object-cover"
      />
      {/* Capa: sempre visível (opacidade reduzida quando não é a capa), sobe a 100%
          no hover — dá mais destaque/intenção do que o antigo ícone de estrela
          escondido na barra inferior, que dividia espaço com a ação de deletar. */}
      <button
        type="button"
        onClick={onCapa}
        disabled={foto.capa}
        className={`absolute left-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-opacity ${
          foto.capa
            ? "bg-primary text-primary-foreground opacity-100"
            : "bg-black/60 text-white opacity-60 hover:opacity-100 group-hover:opacity-100"
        }`}
      >
        <Star className="h-3 w-3" fill={foto.capa ? "currentColor" : "none"} />
        {foto.capa ? "Capa" : "Tornar capa"}
      </button>
      {temMarca && (
        <span
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
          title="Marca d'água aplicada"
        >
          <Droplets className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          {...attributes}
          {...listeners}
          className="rounded p-1 text-white"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button size="sm" variant="ghost" className="text-white" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function FotosManager({
  fotos,
  imovelId,
  tenantId,
  marcaDaguaAtiva,
  logoUrl,
  onChange,
}: {
  fotos: Foto[];
  imovelId: string;
  tenantId: string;
  marcaDaguaAtiva: boolean;
  logoUrl: string | null;
  onChange: () => void;
}) {
  const [items, setItems] = useState(fotos);
  const [processando, setProcessando] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // sync external
  const fotosSignature = JSON.stringify(
    fotos.map((f) => ({
      id: f.id,
      capa: f.capa,
      ordem: f.ordem,
      storage_path: f.storage_path,
      storage_path_original: f.storage_path_original,
    })),
  );
  useEffect(() => {
    setItems(fotos);
  }, [fotosSignature, fotos]);

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((x) => x.id === active.id);
    const newIdx = items.findIndex((x) => x.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    // persist ordem
    const updates = reordered.map((f, idx) =>
      supabase.from("imovel_fotos").update({ ordem: idx }).eq("id", f.id),
    );
    const res = await Promise.all(updates);
    if (res.some((r) => r.error)) toast.error("Erro ao salvar ordem");
    else toast.success("Ordem atualizada");
    onChange();
  }

  async function setCapa(fotoId: string) {
    await supabase.from("imovel_fotos").update({ capa: false }).eq("imovel_id", imovelId);
    await supabase.from("imovel_fotos").update({ capa: true }).eq("id", fotoId);
    onChange();
  }

  async function deleteFoto(f: Foto) {
    if (!confirm("Remover esta foto?")) return;
    const paths = [f.storage_path, ...(f.storage_path_original ? [f.storage_path_original] : [])];
    await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from("imovel_fotos").delete().eq("id", f.id);
    onChange();
  }

  const semMarca = items.filter((f) => f.storage_path_original === null);
  const comMarca = items.filter((f) => f.storage_path_original !== null);
  const podeAplicar = marcaDaguaAtiva && !!logoUrl && semMarca.length > 0;
  const podeRemover = !marcaDaguaAtiva && comMarca.length > 0;

  async function aplicarEmTodas() {
    if (!logoUrl) return;
    let ok = 0;
    for (let i = 0; i < semMarca.length; i++) {
      const f = semMarca[i];
      setProcessando(`${i + 1}/${semMarca.length}`);
      try {
        const res = await fetch(publicUrl(f.storage_path));
        const blob = await res.blob();
        const original = new File([blob], "foto", { type: blob.type });
        const { file, watermarked } = await aplicarMarcaDagua(original, logoUrl);
        if (!watermarked) continue;
        const newPath = `${tenantId}/${imovelId}/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, file, {
          cacheControl: "3600",
          contentType: file.type,
        });
        if (upErr) continue;
        const { error: updErr } = await (supabase as any)
          .from("imovel_fotos")
          .update({ storage_path: newPath, storage_path_original: f.storage_path })
          .eq("id", f.id);
        if (updErr) {
          await supabase.storage.from(BUCKET).remove([newPath]);
          continue;
        }
        ok++;
      } catch {
        /* segue pra próxima foto — falha isolada não trava o lote */
      }
    }
    setProcessando(null);
    if (ok > 0) toast.success(`Marca d'água aplicada em ${ok} foto(s)`);
    if (ok < semMarca.length)
      toast.error(`${semMarca.length - ok} foto(s) não puderam ser marcadas`);
    onChange();
  }

  async function removerDeTodas() {
    let ok = 0;
    for (let i = 0; i < comMarca.length; i++) {
      const f = comMarca[i];
      setProcessando(`${i + 1}/${comMarca.length}`);
      const marcado = f.storage_path;
      const { error: updErr } = await (supabase as any)
        .from("imovel_fotos")
        .update({ storage_path: f.storage_path_original, storage_path_original: null })
        .eq("id", f.id);
      if (updErr) continue;
      await supabase.storage.from(BUCKET).remove([marcado]);
      ok++;
    }
    setProcessando(null);
    if (ok > 0) toast.success(`Marca d'água removida de ${ok} foto(s)`);
    onChange();
  }

  if (items.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>
    );

  return (
    <div>
      {(podeAplicar || podeRemover) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {podeAplicar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!processando}
              onClick={aplicarEmTodas}
            >
              <Droplets className="mr-1.5 h-3.5 w-3.5" />
              {processando ? `Aplicando… ${processando}` : "Aplicar marca d'água em todas as fotos"}
            </Button>
          )}
          {podeRemover && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!processando}
              onClick={removerDeTodas}
            >
              <DropletOff className="mr-1.5 h-3.5 w-3.5" />
              {processando ? `Removendo… ${processando}` : "Remover marca d'água de todas as fotos"}
            </Button>
          )}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((f) => (
              <SortableItem
                key={f.id}
                foto={f}
                onCapa={() => setCapa(f.id)}
                onDelete={() => deleteFoto(f)}
              />
            ))}
          </div>
        </SortableContext>
        <p className="mt-2 text-xs text-muted-foreground">
          Arraste as fotos para reordenar. Use "Tornar capa" para escolher a foto de destaque do
          anúncio.
        </p>
      </DndContext>
    </div>
  );
}
