import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, UserCircle2, Pencil, Trash2, ExternalLink, Star, Award, HeartHandshake, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/corretores/")({
  component: CorretoresList,
});

type Corretor = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  creci: string | null;
  creci_uf: string | null;
  foto_url: string | null;
  slug: string;
  ativo: boolean;
  publico: boolean;
  cargo: string | null;
};

function CorretoresList() {
  const [items, setItems] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 360 Evaluations State & Actions (Sprint 6)
  const [evaluations, setEvaluations] = useState<any[]>([
    {
      avaliador: "Mariana Silva",
      relacao: "Cliente Comprador",
      corretorNome: "Gustavo Reis",
      atendimento: 5,
      negociacao: 4,
      pontualidade: 5,
      comentario: "Excelente profissional. Nos acompanhou em 3 visitas no final de semana e foi incansável na negociação de venda do apartamento.",
      data: "24/05/2026"
    },
    {
      avaliador: "Camila Costa",
      relacao: "Corretor Parceiro",
      corretorNome: "Aline Souza",
      atendimento: 5,
      negociacao: 5,
      pontualidade: 5,
      comentario: "Ótima parceria de co-corretagem! Split de comissão 50/50 pago certinho e contrato rápido.",
      data: "22/05/2026"
    },
    {
      avaliador: "Roberto Santos",
      relacao: "Cliente Proprietário",
      corretorNome: "Felipe Dias",
      atendimento: 4,
      negociacao: 5,
      pontualidade: 4,
      comentario: "Muito prestativo. Ajudou com as dúvidas técnicas de avaliação patrimonial física.",
      data: "18/05/2026"
    }
  ]);

  const [formAvaliador, setFormAvaliador] = useState("");
  const [formRelacao, setFormRelacao] = useState("Cliente Comprador");
  const [formCorretorId, setFormCorretorId] = useState("");
  const [formAtendimento, setFormAtendimento] = useState(5);
  const [formNegociacao, setFormNegociacao] = useState(5);
  const [formPontualidade, setFormPontualidade] = useState(5);
  const [formComentario, setFormComentario] = useState("");

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formAvaliador.trim() || !formCorretorId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const corrObj = items.find((itm) => itm.id === formCorretorId);
    const corrNomeSelected = corrObj ? corrObj.nome : "Corretor Associado";
    const newEv = {
      avaliador: formAvaliador.trim(),
      relacao: formRelacao,
      corretorNome: corrNomeSelected,
      atendimento: formAtendimento,
      negociacao: formNegociacao,
      pontualidade: formPontualidade,
      comentario: formComentario.trim(),
      data: new Date().toLocaleDateString("pt-BR"),
    };
    setEvaluations([newEv, ...evaluations]);
    toast.success("Avaliação 360 registrada!");
    setFormAvaliador("");
    setFormCorretorId("");
    setFormComentario("");
    setFormAtendimento(5);
    setFormNegociacao(5);
    setFormPontualidade(5);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("corretores")
      .select("id,nome,email,telefone,creci,creci_uf,foto_url,slug,ativo,publico,cargo")
      .order("nome");
    if (error) toast.error("Erro ao carregar: " + error.message);
    setItems((data as Corretor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este corretor?")) return;
    const { error } = await (supabase as any).from("corretores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Corretor excluído");
    load();
  }

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.creci ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Corretores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Equipe de corretores da imobiliária</p>
        </div>
        <Button asChild>
          <Link to="/app/corretores/novo"><Plus className="mr-2 h-4 w-4" /> Novo corretor</Link>
        </Button>
      </div>

      <div className="mt-6">
        <Input placeholder="Buscar por nome, CRECI ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <UserCircle2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "Nenhum corretor cadastrado ainda." : "Nenhum resultado."}
            </p>
            {items.length === 0 && (
              <Button asChild size="sm"><Link to="/app/corretores/novo">Cadastrar primeiro corretor</Link></Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3">CRECI</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.foto_url ? (
                        <img src={c.foto_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                      )}
                      <div>
                        <Link to="/app/corretores/$id" params={{ id: c.id }} className="font-medium hover:text-primary">{c.nome}</Link>
                        {c.cargo && <div className="text-xs text-muted-foreground">{c.cargo}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.creci ? `${c.creci}${c.creci_uf ? "/" + c.creci_uf : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{c.email ?? "—"}</div>
                    {c.telefone && <div className="text-xs">{c.telefone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {!c.ativo ? (
                      <Badge variant="secondary">Inativo</Badge>
                    ) : c.publico ? (
                      <Badge>Público</Badge>
                    ) : (
                      <Badge variant="outline">Ativo · interno</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {c.ativo && c.publico && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/corretor/${c.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/app/corretores/$id" params={{ id: c.id }}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sistema de Avaliações 360 (Sprint 6) */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Feed de avaliações coletadas */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Avaliações 360 · Satisfação e Parcerias</h2>
              <p className="text-xs text-muted-foreground">Índice multidimensional de corretores avaliados por clientes e parceiros de co-corretagem</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {evaluations.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma avaliação cadastrada no portal.</p>
            ) : (
              evaluations.map((ev, idx) => (
                <div key={idx} className="rounded-xl border border-border p-4 space-y-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-foreground">{ev.avaliador}</span>
                      <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold font-sans capitalize">{ev.relacao}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {ev.data}
                    </div>
                  </div>

                  <div className="text-xs">
                    Avaliado: <strong className="text-foreground">{ev.corretorNome}</strong>
                  </div>

                  {/* Multi-dimensional marks (Atendimento, Negociação, Pontualidade) */}
                  <div className="grid grid-cols-3 gap-3 bg-background p-2.5 rounded-lg border border-border/50 text-[11px] text-muted-foreground text-center">
                    <div>
                      <div className="font-medium">Atendimento</div>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < ev.atendimento ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Negociação</div>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < ev.negociacao ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Pontualidade</div>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < ev.pontualidade ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {ev.comentario && (
                    <p className="text-xs italic text-muted-foreground/95 bg-background/50 border-l-2 border-primary/20 p-2 rounded-r-md">
                      "{ev.comentario}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Formulário para registrar avaliação */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit space-y-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-foreground">Coletar Novo Feedback</h3>
          </div>
          
          <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="mb-1 block font-medium text-muted-foreground">Avaliador (Nome completo)</label>
              <Input
                placeholder="Ex: Mariana Silva"
                value={formAvaliador}
                onChange={(e) => setFormAvaliador(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted-foreground">Relação</label>
              <select
                value={formRelacao}
                onChange={(e) => setFormRelacao(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Cliente Comprador">Cliente Comprador</option>
                <option value="Cliente Proprietário">Cliente Proprietário</option>
                <option value="Corretor Parceiro">Corretor Parceiro (Co-corretagem)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted-foreground">Corretor do time</label>
              <select
                value={formCorretorId}
                onChange={(e) => setFormCorretorId(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 ring-offset-background focus:outline-none focus:ring-1"
                required
              >
                <option value="">Selecione o corretor...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Cordialidade & Atendimento</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((st) => (
                    <button type="button" key={st} onClick={() => setFormAtendimento(st)}>
                      <Star className={`h-4 w-4 ${st <= formAtendimento ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Expertise de Negociação</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((st) => (
                    <button type="button" key={st} onClick={() => setFormNegociacao(st)}>
                      <Star className={`h-4 w-4 ${st <= formNegociacao ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Pontualidade & Compromisso</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((st) => (
                    <button type="button" key={st} onClick={() => setFormPontualidade(st)}>
                      <Star className={`h-4 w-4 ${st <= formPontualidade ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <label className="mb-1 block font-medium text-muted-foreground">Comentários e Feedbacks</label>
              <Textarea
                rows={3}
                placeholder="Ex: Ótima postura profissional, facilitou mto o fluxo..."
                value={formComentario}
                onChange={(e) => setFormComentario(e.target.value)}
                className="text-xs"
              />
            </div>

            <Button type="submit" size="sm" className="w-full h-9">Registrar Avaliação</Button>
          </form>
        </div>
      </div>
    </div>
  );
}