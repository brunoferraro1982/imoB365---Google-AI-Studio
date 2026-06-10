import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ExternalLink, ImagePlus, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/ImovelForm";
import { ImovelHistorico } from "@/components/imoveis/ImovelHistorico";
import { FotosManager, type Foto } from "@/components/imoveis/FotosManager";
import { useServerFn } from "@tanstack/react-start";
import { geocodeAddress } from "@/lib/geocode.functions";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/imoveis/$id")({
  component: EditarImovel,
});

function EditarImovel() {
  const { id } = Route.useParams();
  const { tenantId } = useAuth();
  const [initial, setInitial] = useState<Partial<ImovelFormData> | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imovel, setImovel] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const geocode = useServerFn(geocodeAddress);

  async function load() {
    setLoading(true);
    const [{ data: imovel, error }, { data: fotosData }] = await Promise.all([
      supabase.from("imoveis").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("imovel_fotos")
        .select("*")
        .eq("imovel_id", id)
        .order("ordem")
        .order("created_at"),
    ]);
    if (error || !imovel) {
      toast.error("Imóvel não encontrado");
      setLoading(false);
      return;
    }
    setImovel(imovel);
    setSlug(imovel.slug);
    setInitial({
      titulo: imovel.titulo,
      slug: imovel.slug,
      codigo_interno: imovel.codigo_interno ?? "",
      descricao: imovel.descricao ?? "",
      finalidade: imovel.finalidade,
      tipo: imovel.tipo,
      status: imovel.status,
      preco: Number(imovel.preco),
      condominio: imovel.condominio,
      iptu: imovel.iptu,
      area_total: imovel.area_total,
      area_util: imovel.area_util,
      quartos: imovel.quartos,
      suites: imovel.suites,
      banheiros: imovel.banheiros,
      vagas: imovel.vagas,
      endereco_cep: imovel.endereco_cep ?? "",
      endereco_logradouro: imovel.endereco_logradouro ?? "",
      endereco_numero: imovel.endereco_numero ?? "",
      endereco_complemento: imovel.endereco_complemento ?? "",
      endereco_bairro: imovel.endereco_bairro ?? "",
      endereco_cidade: imovel.endereco_cidade ?? "",
      endereco_uf: imovel.endereco_uf ?? "",
      mostrar_endereco_publico: imovel.mostrar_endereco_publico,
      aceita_financiamento: imovel.aceita_financiamento,
      aceita_permuta: imovel.aceita_permuta,
      publicado: imovel.publicado,
      corretor_responsavel_id: imovel.corretor_responsavel_id,
      custom_data: (imovel as any).custom_data ?? {},
    });
    setFotos((fotosData as Foto[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save(data: ImovelFormData, action: "save" | "publish" | "unpublish" = "save") {
    setSaving(true);
    const newSlug = data.slug || slugify(data.titulo);
    const { error } = await supabase
      .from("imoveis")
      .update({
        ...data,
        finalidade: data.finalidade as "venda" | "aluguel" | "temporada",
        tipo: data.tipo as never,
        status: data.status as never,
        slug: newSlug,
        publicado_em: data.publicado ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setSlug(newSlug);
    toast.success(
      action === "publish"
        ? "Imóvel publicado no site"
        : action === "unpublish"
          ? "Imóvel despublicado"
          : "Alterações salvas",
    );
    load();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !tenantId) return;
    setUploading(true);
    let nextOrdem = fotos.length;
    let hasCapa = fotos.some((f) => f.capa);
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const fname = `${crypto.randomUUID()}.${ext}`;
      const path = `${tenantId}/${id}/${fname}`;
      const { error: upErr } = await supabase.storage.from("imovel-fotos").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (upErr) {
        toast.error("Upload falhou: " + upErr.message);
        continue;
      }
      const { error: insErr } = await supabase.from("imovel_fotos").insert({
        imovel_id: id,
        tenant_id: tenantId,
        storage_path: path,
        ordem: nextOrdem++,
        capa: !hasCapa,
      });
      if (insErr) toast.error("Erro ao registrar foto: " + insErr.message);
      else hasCapa = true;
    }
    setUploading(false);
    load();
  }

  async function geocodeNow() {
    if (!imovel) return;
    const parts = [
      imovel.endereco_logradouro,
      imovel.endereco_numero,
      imovel.endereco_bairro,
      imovel.endereco_cidade,
      imovel.endereco_uf,
    ]
      .filter(Boolean)
      .join(", ");
    if (!parts) return toast.error("Preencha o endereço primeiro");
    setGeoLoading(true);
    try {
      const r = await geocode({ data: { query: parts } });
      if (!r.ok) return toast.error(r.error);
      await supabase.from("imoveis").update({ latitude: r.lat, longitude: r.lon }).eq("id", id);
      toast.success("Coordenadas atualizadas");
      load();
    } finally {
      setGeoLoading(false);
    }
  }

  async function toggleDestaque() {
    if (!imovel) return;
    await (supabase as any).from("imoveis").update({ destaque: !imovel.destaque }).eq("id", id);
    load();
  }

  if (loading || !initial) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/imoveis">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        {slug && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/imovel/${slug}`} target="_blank" rel="noreferrer">
              Ver no site <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{initial.titulo}</h1>

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fotos</h2>
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
        </div>
        <FotosManager fotos={fotos} imovelId={id} onChange={load} />
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Destaque & localização</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={imovel?.destaque ? "default" : "outline"} onClick={toggleDestaque}>
            <Sparkles className="mr-2 h-4 w-4" />
            {imovel?.destaque ? "Em destaque" : "Marcar como destaque"}
          </Button>
          <Button variant="outline" onClick={geocodeNow} disabled={geoLoading}>
            <MapPin className="mr-2 h-4 w-4" />
            {geoLoading ? "Buscando…" : "Atualizar coordenadas (mapa)"}
          </Button>
          {imovel?.latitude && imovel?.longitude && (
            <span className="text-xs text-muted-foreground">
              {Number(imovel.latitude).toFixed(5)}, {Number(imovel.longitude).toFixed(5)}
            </span>
          )}
          {imovel?.selos?.length > 0 && (
            <div className="flex gap-1">
              {imovel.selos.map((s: string) => (
                <span
                  key={s}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {s.replace("_", " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <ImovelForm
        initial={initial}
        onSubmit={save}
        submitLabel="Salvar alterações"
        submitting={saving}
        mode="edit"
      />

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de alterações
        </h2>
        <ImovelHistorico imovelId={id} />
      </section>
    </div>
  );
}
