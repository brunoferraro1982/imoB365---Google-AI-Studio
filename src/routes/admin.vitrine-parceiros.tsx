import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { Factory, Building2, ArrowUp, ArrowDown, Trash2, GalleryHorizontalEnd } from "lucide-react";

export const Route = createFileRoute("/admin/vitrine-parceiros")({
  component: AdminVitrineParceirosPage,
});

// Curadoria da faixa "Imobiliárias e Construtoras Parceiras" da home
// (ParceirosMarquee, em site-layout.tsx). Escrita protegida por RLS de
// super_admin nas tabelas vitrine_parceiros e global_settings.

type Tipo = "imobiliaria" | "construtora";
type VitrineRow = { id: string; tipo: Tipo; ref_id: string; ordem: number; ativo: boolean };
type Item = VitrineRow & { nome: string; slug: string; logoUrl: string | null };
type Opcao = { id: string; nome: string; logoUrl: string | null };

// Presets de velocidade (segundos do ciclo do marquee) — mais amigável que
// pedir segundos crus pro super_admin.
const VELOCIDADES = [
  { label: "Lenta", seconds: 45 },
  { label: "Média", seconds: 28 },
  { label: "Rápida", seconds: 16 },
];

function AdminVitrineParceirosPage() {
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [itens, setItens] = useState<Item[]>([]);
  const [construtoras, setConstrutoras] = useState<Opcao[]>([]);
  const [imobiliarias, setImobiliarias] = useState<Opcao[]>([]);
  const [speed, setSpeed] = useState(28);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: vp }, { data: cs }, { data: ts }, { data: cfg }] = await Promise.all([
      (supabase as any).from("vitrine_parceiros").select("*").order("ordem"),
      supabase.from("construtoras").select("id,nome,slug,logo_url").eq("ativo", true).order("nome"),
      supabase
        .from("tenants")
        .select("id,nome,slug,tema,tipo_tenant,status")
        .eq("tipo_tenant", "imobiliaria")
        .in("status", ["active", "trial"])
        .order("nome"),
      supabase.from("global_settings").select("value").eq("key", "vitrine_marquee").maybeSingle(),
    ]);

    const rows = (vp ?? []) as VitrineRow[];
    const cMap = new Map(
      ((cs ?? []) as any[]).map((c) => [
        c.id,
        { nome: c.nome, slug: c.slug, logoUrl: c.logo_url as string | null },
      ]),
    );
    const tMap = new Map(
      ((ts ?? []) as any[]).map((t) => [
        t.id,
        {
          nome: t.nome,
          slug: t.slug,
          logoUrl: (t.tema as { logo_url?: string } | null)?.logo_url ?? null,
        },
      ]),
    );

    const mapped: Item[] = rows.map((r) => {
      const det = (r.tipo === "construtora" ? cMap.get(r.ref_id) : tMap.get(r.ref_id)) ?? {
        nome: "(removido/indisponível)",
        slug: "",
        logoUrl: null,
      };
      return { ...r, ...det };
    });
    setItens(mapped);

    const usados = new Set(rows.map((r) => `${r.tipo}:${r.ref_id}`));
    setConstrutoras(
      ((cs ?? []) as any[])
        .filter((c) => !usados.has(`construtora:${c.id}`))
        .map((c) => ({ id: c.id, nome: c.nome, logoUrl: c.logo_url })),
    );
    setImobiliarias(
      ((ts ?? []) as any[])
        .filter((t) => !usados.has(`imobiliaria:${t.id}`))
        .map((t) => ({
          id: t.id,
          nome: t.nome,
          logoUrl: (t.tema as { logo_url?: string } | null)?.logo_url ?? null,
        })),
    );

    const s = Number((cfg?.value as { speedSeconds?: number } | null)?.speedSeconds);
    if (s > 0) setSpeed(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function adicionar(tipo: Tipo, ref_id: string) {
    const ordem = itens.length ? Math.max(...itens.map((i) => i.ordem)) + 1 : 0;
    const { error } = await (supabase as any)
      .from("vitrine_parceiros")
      .insert({ tipo, ref_id, ordem, ativo: true });
    if (error) return toast.error("Erro ao adicionar: " + error.message);
    toast.success("Adicionado à vitrine");
    load();
  }

  async function toggleAtivo(item: Item, ativo: boolean) {
    const { error } = await (supabase as any)
      .from("vitrine_parceiros")
      .update({ ativo })
      .eq("id", item.id);
    if (error) return toast.error("Erro: " + error.message);
    load();
  }

  async function remover(item: Item) {
    const ok = await confirmDialog(
      `"${item.nome}" deixará de aparecer na faixa de parceiros da home.`,
      { title: "Remover da vitrine?", confirmLabel: "Remover", variant: "destructive" },
    );
    if (!ok) return;
    const { error } = await (supabase as any).from("vitrine_parceiros").delete().eq("id", item.id);
    if (error) return toast.error("Erro ao remover: " + error.message);
    toast.success("Removido");
    load();
  }

  async function mover(index: number, dir: "up" | "down") {
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= itens.length) return;
    const a = itens[index];
    const b = itens[j];
    // Troca os valores de ordem entre os dois vizinhos.
    const [r1, r2] = await Promise.all([
      (supabase as any).from("vitrine_parceiros").update({ ordem: b.ordem }).eq("id", a.id),
      (supabase as any).from("vitrine_parceiros").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    if (r1.error || r2.error)
      return toast.error("Erro ao reordenar: " + (r1.error?.message || r2.error?.message));
    load();
  }

  async function salvarVelocidade(seconds: number) {
    setSpeed(seconds);
    const { error } = await supabase
      .from("global_settings")
      .upsert({ key: "vitrine_marquee", value: { speedSeconds: seconds } }, { onConflict: "key" });
    if (error) return toast.error("Erro ao salvar velocidade: " + error.message);
    toast.success("Velocidade atualizada");
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 p-6">
      <ConfirmDialog />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <GalleryHorizontalEnd className="h-6 w-6 text-primary" />
          Vitrine de Parceiros
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha quais imobiliárias e construtoras aparecem na faixa de logos da home, a ordem e a
          velocidade do carrossel.
        </p>
      </div>

      {/* Velocidade */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <span className="text-sm font-semibold">Velocidade do carrossel</span>
        <Select value={String(speed)} onValueChange={(v) => salvarVelocidade(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VELOCIDADES.map((v) => (
              <SelectItem key={v.seconds} value={String(v.seconds)}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          (só tem efeito quando há logos suficientes pra rolar; com poucos, ficam estáticos)
        </span>
      </div>

      {/* Adicionar */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> Adicionar imobiliária
          </p>
          <Select
            value=""
            onValueChange={(v) => adicionar("imobiliaria", v)}
            disabled={imobiliarias.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={imobiliarias.length ? "Escolher…" : "Nenhuma disponível"} />
            </SelectTrigger>
            <SelectContent>
              {imobiliarias.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Factory className="h-4 w-4 text-primary" /> Adicionar construtora
          </p>
          <Select
            value=""
            onValueChange={(v) => adicionar("construtora", v)}
            disabled={construtoras.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={construtoras.length ? "Escolher…" : "Nenhuma disponível"} />
            </SelectTrigger>
            <SelectContent>
              {construtoras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista ordenável */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Na vitrine ({itens.length})</p>
        {itens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum parceiro na vitrine. Adicione imobiliárias ou construtoras acima.
          </p>
        ) : (
          itens.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={i === 0}
                  onClick={() => mover(i, "up")}
                  aria-label="Subir"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={i === itens.length - 1}
                  onClick={() => mover(i, "down")}
                  aria-label="Descer"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md border border-border/60 bg-white">
                {item.logoUrl ? (
                  <img src={item.logoUrl} alt={item.nome} className="h-7 w-auto object-contain" />
                ) : item.tipo === "construtora" ? (
                  <Factory className="h-4 w-4 text-neutral-400" />
                ) : (
                  <Building2 className="h-4 w-4 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.nome}</p>
                <Badge variant="secondary" className="mt-0.5 text-[10px]">
                  {item.tipo === "construtora" ? "Construtora" : "Imobiliária"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch checked={item.ativo} onCheckedChange={(v) => toggleAtivo(item, v)} />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => remover(item)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
