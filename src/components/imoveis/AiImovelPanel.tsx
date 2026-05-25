import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, Wand2, Megaphone, Type, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { gerarDescricaoImovel, gerarTituloImovel, gerarPostRedesImovel, gerarMetatagsSEO } from "@/lib/ai.functions";
import type { ImovelFormData } from "./ImovelForm";

type Tom = "profissional" | "acolhedor" | "luxo" | "objetivo";

function brief(data: Partial<ImovelFormData>, caracteristicas: string, tom: Tom) {
  return {
    data: {
      titulo: data.titulo ?? "",
      finalidade: data.finalidade ?? "venda",
      tipo: data.tipo ?? "apartamento",
      bairro: data.endereco_bairro ?? "",
      cidade: data.endereco_cidade ?? "",
      quartos: data.quartos ?? null,
      area_util: data.area_util ?? null,
      preco: data.preco ?? null,
      caracteristicas,
      tom,
    },
  };
}

export function AiImovelPanel({
  data,
  onApplyDescricao,
  onApplyTitulo,
}: {
  data: Partial<ImovelFormData>;
  onApplyDescricao: (texto: string) => void;
  onApplyTitulo: (texto: string) => void;
}) {
  const [tom, setTom] = useState<Tom>("profissional");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<"" | "desc" | "title" | "post" | "seo">("");
  const [titulos, setTitulos] = useState<string[]>([]);
  const [post, setPost] = useState("");
  const [seoResult, setSeoResult] = useState<{ seo_title: string; meta_description: string; keywords: string } | null>(null);

  const gDesc = useServerFn(gerarDescricaoImovel);
  const gTit = useServerFn(gerarTituloImovel);
  const gPost = useServerFn(gerarPostRedesImovel);
  const gSeo = useServerFn(gerarMetatagsSEO);

  async function run(kind: "desc" | "title" | "post" | "seo") {
    setBusy(kind);
    try {
      if (kind === "desc") {
        const r = await gDesc(brief(data, extra, tom));
        onApplyDescricao(r.descricao);
        toast.success("Descrição gerada");
      } else if (kind === "title") {
        const r = await gTit(brief(data, extra, tom));
        setTitulos(r.titulos);
      } else if (kind === "post") {
        const r = await gPost(brief(data, extra, tom));
        setPost(r.post);
      } else {
        const r = await gSeo({
          data: {
            titulo: data.titulo ?? "Excelente imóvel",
            descricao: data.descricao ?? "",
            bairro: data.endereco_bairro ?? "",
            cidade: data.endereco_cidade ?? "",
            tipo: data.tipo ?? "apartamento",
          }
        });
        setSeoResult(r.seo);
        toast.success("Tags SEO otimizadas com sucesso!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar com IA");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" /> Assistente IA do anúncio
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Usa os campos preenchidos acima para gerar título, descrição, post de redes de engajamento e metatags estruturadas de SEO.
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-[180px,1fr]">
        <div>
          <label className="mb-1 block text-xs font-medium">Tom de voz</label>
          <Select value={tom} onValueChange={(v) => setTom(v as Tom)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="profissional">Profissional</SelectItem>
              <SelectItem value="acolhedor">Acolhedor</SelectItem>
              <SelectItem value="luxo">Alto padrão</SelectItem>
              <SelectItem value="objetivo">Objetivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Características extras (opcional)</label>
          <Textarea
            rows={2}
            placeholder="Ex: vista mar, próximo da praia, varanda gourmet..."
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="default" onClick={() => run("desc")} disabled={busy !== ""}>
          {busy === "desc" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Gerar descrição
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => run("title")} disabled={busy !== ""}>
          {busy === "title" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Type className="mr-2 h-4 w-4" />}
          Sugerir títulos
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => run("post")} disabled={busy !== ""}>
          {busy === "post" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
          Post para redes
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => run("seo")} disabled={busy !== ""}>
          {busy === "seo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4 text-emerald-600" />}
          Otimizar SEO (Tags)
        </Button>
      </div>

      {titulos.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Sugestões de título:</div>
          {titulos.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-sm">
              <span className="truncate">{t}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => { onApplyTitulo(t); toast.success("Título aplicado"); }}>
                Usar
              </Button>
            </div>
          ))}
        </div>
      )}

      {post && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Post sugerido:</div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { navigator.clipboard.writeText(post); toast.success("Copiado"); }}
            >
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </Button>
          </div>
          <Textarea readOnly rows={5} value={post} />
        </div>
      )}

      {seoResult && (
        <div className="mt-3 p-3 bg-emerald-500/5 rounded border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">⚡ Otimização de SEO Concluída</div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const text = `SEO Title: ${seoResult.seo_title}\nMeta Description: ${seoResult.meta_description}\nKeywords: ${seoResult.keywords}`;
                navigator.clipboard.writeText(text);
                toast.success("Metatags copiadas!");
              }}
              className="text-xs px-2 h-7"
            >
              <Copy className="mr-1 h-3 w-3" /> Copiar Tudo
            </Button>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-bold block text-muted-foreground">SEO Meta Title (Google Search Title)</span>
              <div className="border bg-background px-2 py-1.5 rounded font-mono text-[11px] truncate">{seoResult.seo_title}</div>
            </div>
            <div>
              <span className="font-bold block text-muted-foreground">Meta Description Spec (snippet)</span>
              <div className="border bg-background px-2 py-1.5 rounded font-mono text-[11px] whitespace-pre-wrap">{seoResult.meta_description}</div>
            </div>
            <div>
              <span className="font-bold block text-muted-foreground">Organic Focus Keywords</span>
              <div className="border bg-background px-2 py-1.5 rounded font-mono text-[11px]">{seoResult.keywords}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}