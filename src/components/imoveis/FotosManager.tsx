import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export type Foto = { id: string; storage_path: string; capa: boolean; ordem: number };

function publicUrl(path: string) {
  return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
}

function SortableItem({ foto, onCapa, onDelete }: { foto: Foto; onCapa: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: foto.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <img src={publicUrl(foto.storage_path)} alt="" className="aspect-square w-full object-cover" />
      {foto.capa && (
        <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Capa</span>
      )}
      <button
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button size="sm" variant="ghost" className="text-white" onClick={onCapa} disabled={foto.capa}>
          <Star className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="text-white" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function FotosManager({ fotos, imovelId, onChange }: { fotos: Foto[]; imovelId: string; onChange: () => void }) {
  const [items, setItems] = useState(fotos);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // sync external
  const fotosSignature = JSON.stringify(fotos.map((f) => ({ id: f.id, capa: f.capa, ordem: f.ordem, storage_path: f.storage_path })));
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
    const updates = reordered.map((f, idx) => supabase.from("imovel_fotos").update({ ordem: idx }).eq("id", f.id));
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
    await supabase.storage.from("imovel-fotos").remove([f.storage_path]);
    await supabase.from("imovel_fotos").delete().eq("id", f.id);
    onChange();
  }

  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((f) => (
            <SortableItem key={f.id} foto={f} onCapa={() => setCapa(f.id)} onDelete={() => deleteFoto(f)} />
          ))}
        </div>
      </SortableContext>
      <p className="mt-2 text-xs text-muted-foreground">Arraste as fotos para reordenar. A primeira foto vira a capa do anúncio.</p>
    </DndContext>
  );
}