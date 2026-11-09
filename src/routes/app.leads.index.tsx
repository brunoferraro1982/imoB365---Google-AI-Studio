import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Users, Settings2, GitBranch, Trophy, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/")({
  component: LeadsKanban,
});

type Lead = {
  id: string;
  tenant_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  status: string;
  funil_id: string | null;
  etapa_id: string | null;
  score: number | null;
  imovel_id: string | null;
  corretor_id: string | null;
  created_at: string;
};

type Funil = { id: string; nome: string; is_default: boolean; ativo: boolean };
type Etapa = {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  categoria: string;
};

function LeadsKanban() {
  const { tenantId } = useAuth();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [funilId, setFunilId] = useState<string>("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [items, setItems] = useState<Lead[]>([]);
  const [corretores, setCorretores] = useState<Record<string, string>>({});
  const [imoveis, setImoveis] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ordenar, setOrdenar] = useState<"recentes" | "score">("recentes");
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: fs }, { data: es }, { data: leads, error }, { data: cors }, { data: imos }] =
      await Promise.all([
        (supabase as any)
          .from("lead_funis")
          .select("id,nome,is_default,ativo")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("created_at"),
        (supabase as any)
          .from("lead_funil_etapas")
          .select("id,funil_id,nome,ordem,cor,categoria")
          .eq("tenant_id", tenantId)
          .order("ordem"),
        (supabase as any)
          .from("leads")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
        (supabase as any).from("corretores").select("id,nome"),
        (supabase as any).from("imoveis").select("id,titulo"),
      ]);
    if (error) toast.error(error.message);
    const lista = (fs as Funil[]) ?? [];
    setFunis(lista);
    setEtapas((es as Etapa[]) ?? []);
    setItems((leads as Lead[]) ?? []);
    setCorretores(Object.fromEntries((cors ?? []).map((c: any) => [c.id, c.nome])));
    setImoveis(Object.fromEntries((imos ?? []).map((i: any) => [i.id, i.titulo])));
    setFunilId((atual) =>
      atual && lista.some((f) => f.id === atual)
        ? atual
        : ((lista.find((f) => f.is_default) ?? lista[0])?.id ?? ""),
    );
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const etapasDoFunil = useMemo(
    () => etapas.filter((e) => e.funil_id === funilId),
    [etapas, funilId],
  );
  const primeiraEtapa = etapasDoFunil[0]?.id;

  async function moveTo(id: string, etapaId: string) {
    const prev = items.find((l) => l.id === id);
    const destino = etapasDoFunil.find((e) => e.id === etapaId);
    if (!prev || !destino || prev.etapa_id === etapaId) return;
    const origem = etapasDoFunil.find((e) => e.id === prev.etapa_id);
    const { error } = await (supabase as any)
      .from("leads")
      .update({ etapa_id: etapaId })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return load();
    }
    await (supabase as any).from("lead_interacoes").insert({
      lead_id: id,
      tenant_id: prev.tenant_id,
      tipo: "mudanca_etapa",
      conteudo: `${origem?.nome ?? "Sem etapa"} → ${destino.nome}`,
    });
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let lista = items.filter((l) => l.funil_id === funilId);
    if (q) {
      lista = lista.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.telefone ?? "").toLowerCase().includes(q),
      );
    }
    if (ordenar === "score") lista = [...lista].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return lista;
  }, [items, funilId, search, ordenar]);

  const funilAtual = funis.find((f) => f.id === funilId);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {funilAtual ? `Funil: ${funilAtual.nome}` : "Crie um funil para organizar os leads"} —
            arraste para mudar a etapa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/leads/funis">
              <GitBranch className="mr-2 h-4 w-4" /> Funis
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/leads/pontuacao">
              <Trophy className="mr-2 h-4 w-4" /> Pontuação
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/leads/cadencias">
              <Workflow className="mr-2 h-4 w-4" /> Cadências
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/leads/configuracao">
              <Settings2 className="mr-2 h-4 w-4" /> Distribuição
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {funis.length > 1 && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={funilId}
            onChange={(e) => setFunilId(e.target.value)}
            aria-label="Funil"
          >
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
                {f.is_default ? " (padrão)" : ""}
              </option>
            ))}
          </select>
        )}
        <Input
          placeholder="Buscar por nome, e-mail, telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={ordenar}
          onChange={(e) => setOrdenar(e.target.value as "recentes" | "score")}
          aria-label="Ordenar"
        >
          <option value="recentes">Mais recentes</option>
          <option value="score">Maior pontuação</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : funis.length === 0 || etapasDoFunil.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-16 text-center">
          <GitBranch className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Este funil ainda não tem etapas.</p>
          <Button variant="outline" asChild>
            <Link to="/app/leads/funis">Configurar funis</Link>
          </Button>
        </div>
      ) : filtered.length === 0 && items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum lead recebido ainda. Eles aparecem aqui assim que alguém envia uma mensagem pelo
            site.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
          {etapasDoFunil.map((etapa) => {
            const cards = filtered.filter((l) => (l.etapa_id ?? primeiraEtapa) === etapa.id);
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) {
                    moveTo(dragId, etapa.id);
                    setDragId(null);
                  }
                }}
                className="flex min-h-[200px] flex-col rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 rounded-md bg-card px-2 py-0.5 text-xs font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: etapa.cor ?? "#94a3b8" }}
                    />
                    {etapa.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((l) => (
                    <Link
                      key={l.id}
                      to="/app/leads/$id"
                      params={{ id: l.id }}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      className="block cursor-grab rounded-lg border border-border bg-card p-3 text-sm shadow-sm hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{l.nome}</div>
                        <span
                          className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
                          title="Pontuação do lead"
                        >
                          {l.score ?? 0} pts
                        </span>
                      </div>
                      {l.imovel_id && imoveis[l.imovel_id] && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {imoveis[l.imovel_id]}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
                        {l.corretor_id && corretores[l.corretor_id] && (
                          <Badge variant="outline" className="text-[10px]">
                            {corretores[l.corretor_id]}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
