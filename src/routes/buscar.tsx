import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, TIPO_LABEL } from "@/lib/format";
import { MapPin, Bed, Bath, Maximize2, Map as MapIcon, List, BookmarkPlus } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/routes/index";
import { useServerFn } from "@tanstack/react-start";
import { salvarBusca } from "@/lib/buscas-salvas.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FavoritoButton } from "@/components/FavoritoButton";
import { CompararCheckbox, CompararBar } from "@/components/CompararSelector";

const MapaImoveis = lazy(() => import("@/components/MapaImoveis"));

type SearchParams = {
  q: string;
  finalidade: "todos" | "venda" | "aluguel" | "temporada";
  tipo: string;
  bairro: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  areaMin: string;
  precoMin: string;
  precoMax: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export const Route = createFileRoute("/buscar")({
  validateSearch: (raw: Record<string, unknown>): SearchParams => {
    const fin = str(raw.finalidade);
    return {
      q: str(raw.q),
      finalidade: (["venda", "aluguel", "temporada"].includes(fin) ? fin : "todos") as SearchParams["finalidade"],
      tipo: str(raw.tipo),
      bairro: str(raw.bairro),
      quartos: str(raw.quartos),
      banheiros: str(raw.banheiros),
      vagas: str(raw.vagas),
      areaMin: str(raw.areaMin),
      precoMin: str(raw.precoMin),
      precoMax: str(raw.precoMax),
    };
  },
  head: () => ({
    meta: [
      { title: "Buscar imóveis — imob365" },
      { name: "description", content: "Encontre imóveis à venda e para alugar em todo o Brasil no marketplace imob365." },
      { property: "og:title", content: "Buscar imóveis — imob365" },
      { property: "og:description", content: "Marketplace nacional de imóveis." },
    ],
  }),
  component: Buscar,
});

function Buscar() {
  const sp = Route.useSearch();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(sp.q);
  const [finalidade, setFinalidade] = useState<string>(sp.finalidade);
  const [tipo, setTipo] = useState<string>(sp.tipo);
  const [quartos, setQuartos] = useState<string>(sp.quartos);
  const [vagas, setVagas] = useState<string>(sp.vagas);
  const [precoMin, setPrecoMin] = useState<string>(sp.precoMin);
  const [precoMax, setPrecoMax] = useState<string>(sp.precoMax);
  const [areaMin, setAreaMin] = useState<string>(sp.areaMin);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [mounted, setMounted] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAlert, setSaveAlert] = useState(true);
  const { user } = useAuth();
  const salvar = useServerFn(salvarBusca);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("imoveis")
        .select("id,slug,titulo,finalidade,tipo,preco,quartos,banheiros,vagas,area_util,endereco_cidade,endereco_uf,endereco_bairro,latitude,longitude,imovel_fotos(storage_path,capa,ordem)")
        .eq("publicado", true)
        .eq("status", "ativo")
        .order("updated_at", { ascending: false })
        .limit(240);
      if (finalidade !== "todos") q = q.eq("finalidade", finalidade as "venda" | "aluguel" | "temporada");
      if (tipo) q = q.eq("tipo", tipo as any);
      const quartosN = Number(quartos); if (quartosN > 0) q = q.gte("quartos", quartosN);
      const banheirosN = Number(sp.banheiros); if (banheirosN > 0) q = q.gte("banheiros", banheirosN);
      const vagasN = Number(vagas); if (vagasN > 0) q = q.gte("vagas", vagasN);
      const areaMinN = Number(areaMin); if (areaMinN > 0) q = q.gte("area_util", areaMinN);
      const precoMinN = Number(precoMin); if (precoMinN > 0) q = q.gte("preco", precoMinN);
      const precoMaxN = Number(precoMax); if (precoMaxN > 0) q = q.lte("preco", precoMaxN);
      const { data } = await q;
      const mapped = (data ?? []).map((d: any) => {
        const fotos = (d.imovel_fotos ?? []).slice().sort((a: any, b: any) => (b.capa ? 1 : 0) - (a.capa ? 1 : 0) || a.ordem - b.ordem);
        return { ...d, capa: fotos[0]?.storage_path ?? null };
      });
      setItems(mapped);
      setLoading(false);
    })();
  }, [finalidade, tipo, quartos, sp.banheiros, vagas, areaMin, precoMin, precoMax]);

  function publicUrl(path: string | null) {
    if (!path) return null;
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
  }

  const filtered = items.filter((i) => {
    const term = (search || sp.q || "").toLowerCase();
    const bairroFilter = (sp.bairro || "").toLowerCase();
    if (bairroFilter && !(i.endereco_bairro ?? "").toLowerCase().includes(bairroFilter)) return false;
    if (!term) return true;
    return i.titulo.toLowerCase().includes(term)
      || (i.endereco_cidade ?? "").toLowerCase().includes(term)
      || (i.endereco_bairro ?? "").toLowerCase().includes(term);
  });

  const pontosMapa = useMemo(() => {
    return filtered
      .filter((i) => i.latitude != null && i.longitude != null)
      .map((i) => ({
        id: i.id,
        slug: i.slug,
        titulo: i.titulo,
        preco: Number(i.preco) || 0,
        latitude: Number(i.latitude),
        longitude: Number(i.longitude),
        endereco_bairro: i.endereco_bairro,
        endereco_cidade: i.endereco_cidade,
        capa_url: publicUrl(i.capa),
      }));
  }, [filtered]);

  async function handleSalvarBusca() {
    if (!user) {
      toast.error("Faça login para salvar buscas.");
      return;
    }
    if (!saveName.trim()) {
      toast.error("Dê um nome para a busca.");
      return;
    }
    try {
      await salvar({
        data: {
          nome: saveName.trim(),
          alerta_email: saveAlert,
          filtros: { q: search, finalidade, tipo, quartos, vagas, precoMin, precoMax, areaMin, bairro: sp.bairro },
        },
      });
      toast.success("Busca salva!");
      setSaveOpen(false);
      setSaveName("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Buscar imóveis</h1>
            <p className="mt-2 text-sm text-muted-foreground">Catálogo nacional da plataforma imob365.</p>
          </div>
          <div className="flex gap-2">
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              <Button size="sm" variant={view === "lista" ? "default" : "ghost"} onClick={() => setView("lista")}>
                <List className="mr-1.5 h-4 w-4" /> Lista
              </Button>
              <Button size="sm" variant={view === "mapa" ? "default" : "ghost"} onClick={() => setView("mapa")}>
                <MapIcon className="mr-1.5 h-4 w-4" /> Mapa
              </Button>
            </div>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><BookmarkPlus className="mr-1.5 h-4 w-4" /> Salvar busca</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Salvar esta busca</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ex.: 2 quartos no Canto do Forte" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alerta">Avisar por e-mail novos imóveis</Label>
                    <Switch id="alerta" checked={saveAlert} onCheckedChange={setSaveAlert} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSalvarBusca}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-12">
          <Input
            placeholder="Cidade, bairro ou palavra-chave"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:col-span-4"
          />
          <Select value={finalidade} onValueChange={setFinalidade}>
            <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas finalidades</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="aluguel">Aluguel</SelectItem>
              <SelectItem value="temporada">Temporada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo || "todos"} onValueChange={(v) => setTipo(v === "todos" ? "" : v)}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
            </SelectContent>
          </Select>
          <Select value={quartos || "0"} onValueChange={(v) => setQuartos(v === "0" ? "" : v)}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Quartos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Quartos: qualquer</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vagas || "0"} onValueChange={(v) => setVagas(v === "0" ? "" : v)}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Vagas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Vagas: qualquer</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Preço mín."
            value={precoMin}
            onChange={(e) => setPrecoMin(e.target.value)}
            className="md:col-span-3"
          />
          <Input
            type="number"
            placeholder="Preço máx."
            value={precoMax}
            onChange={(e) => setPrecoMax(e.target.value)}
            className="md:col-span-3"
          />
          <Input
            type="number"
            placeholder="Área mín. (m²)"
            value={areaMin}
            onChange={(e) => setAreaMin(e.target.value)}
            className="md:col-span-3"
          />
          <div className="flex items-center text-xs text-muted-foreground md:col-span-3">
            {loading ? "Carregando…" : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="mt-8">
          {view === "mapa" ? (
            mounted ? (
              <Suspense fallback={<div className="flex h-[600px] items-center justify-center text-sm text-muted-foreground">Carregando mapa…</div>}>
                <MapaImoveis pontos={pontosMapa} />
              </Suspense>
            ) : (
              <div className="flex h-[600px] items-center justify-center text-sm text-muted-foreground">Carregando mapa…</div>
            )
          ) : loading ? (
            <p className="text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">
              Nenhum imóvel publicado encontrado.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((i: any) => (
                <div key={i.id} className="group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    <Link to="/imovel/$slug" params={{ slug: i.slug }} className="block h-full w-full">
                      {i.capa ? (
                        <img src={publicUrl(i.capa)!} alt={i.titulo} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                      )}
                    </Link>
                    <div className="absolute right-2 top-2 z-10">
                      <FavoritoButton imovelId={i.id} className="shadow-sm" />
                    </div>
                    <div className="absolute left-2 top-2 z-10">
                      <CompararCheckbox imovelId={i.id} className="shadow-sm" />
                    </div>
                  </div>
                  <Link to="/imovel/$slug" params={{ slug: i.slug }} className="block p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{FINALIDADE_LABEL[i.finalidade]}</span>
                      <span className="text-muted-foreground">{TIPO_LABEL[i.tipo]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-semibold leading-tight group-hover:text-primary transition-colors">{i.titulo}</h3>
                    {(i.endereco_cidade || i.endereco_bairro) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[i.endereco_bairro, i.endereco_cidade && `${i.endereco_cidade}/${i.endereco_uf ?? ""}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {i.quartos != null && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{i.quartos}</span>}
                      {i.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{i.banheiros}</span>}
                      {i.area_util != null && <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{i.area_util} m²</span>}
                    </div>
                    <p className="mt-3 text-lg font-bold text-primary">{formatBRL(i.preco)}</p>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
      <CompararBar />
    </div>
  );
}