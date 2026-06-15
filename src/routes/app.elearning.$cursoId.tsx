import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Play, FileText,
  ExternalLink, FileDown, BookOpen, GraduationCap, ChevronDown, ChevronUp, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/elearning/$cursoId")({
  component: CourseViewer,
});

// ─── Types ──────────────────────────────────────────────────────────────────

type Aula = {
  id: string;
  titulo: string;
  tipo: string;
  conteudo_html: string | null;
  video_url: string | null;
  arquivo_url: string | null;
  link_externo: string | null;
  duracao_min: number;
  ordem: number;
  gratuita: boolean;
};

type Modulo = {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  aulas: Aula[];
};

type Curso = {
  id: string;
  titulo: string;
  descricao: string | null;
  nivel: string;
  carga_horaria_min: number;
};

// ─── Video embed helper ──────────────────────────────────────────────────────

function getEmbedUrl(url: string): { type: "iframe" | "video"; src: string } | null {
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };

  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { type: "iframe", src: `https://player.vimeo.com/video/${vm[1]}?byline=0&portrait=0` };

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "video", src: url };

  // Generic iframe fallback
  return { type: "iframe", src: url };
}

// ─── Content Renderer ────────────────────────────────────────────────────────

function LessonContent({ aula }: { aula: Aula }) {
  if (aula.tipo === "video" && aula.video_url) {
    const embed = getEmbedUrl(aula.video_url);
    if (embed?.type === "iframe") {
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
          <iframe
            src={embed.src}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={aula.titulo}
          />
        </div>
      );
    }
    if (embed?.type === "video") {
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
          <video src={embed.src} controls className="w-full h-full" />
        </div>
      );
    }
  }

  if (aula.tipo === "pdf" && aula.arquivo_url) {
    return (
      <div className="space-y-4">
        <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-border shadow">
          <iframe src={aula.arquivo_url} className="w-full h-full" title={aula.titulo} />
        </div>
        <a href={aula.arquivo_url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-2">
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        </a>
      </div>
    );
  }

  if (aula.tipo === "link" && aula.link_externo) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center space-y-4">
        <ExternalLink className="h-10 w-10 text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Este conteúdo está disponível em um link externo.</p>
        <a href={aula.link_externo} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2">
            <ExternalLink className="h-4 w-4" /> Acessar conteúdo externo
          </Button>
        </a>
      </div>
    );
  }

  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

function CourseViewer() {
  const { cursoId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [activeAulaId, setActiveAulaId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    load();
  }, [cursoId, user?.id]);

  async function load() {
    setLoading(true);
    const db = supabase as any;

    const [{ data: c }, { data: mods }] = await Promise.all([
      db.from("elearning_cursos").select("id,titulo,descricao,nivel,carga_horaria_min").eq("id", cursoId).maybeSingle(),
      db.from("elearning_modulos").select("id,titulo,descricao,ordem").eq("curso_id", cursoId).order("ordem"),
    ]);

    if (!c) {
      navigate({ to: "/app/elearning" });
      return;
    }

    setCurso(c);

    const modIds = (mods ?? []).map((m: Modulo) => m.id);
    const { data: aulasRaw } = modIds.length
      ? await db
          .from("elearning_aulas")
          .select("id,modulo_id,titulo,tipo,conteudo_html,video_url,arquivo_url,link_externo,duracao_min,ordem,gratuita")
          .in("modulo_id", modIds)
          .order("ordem")
      : { data: [] };

    const aulasByModulo: Record<string, Aula[]> = {};
    for (const a of aulasRaw ?? []) {
      if (!aulasByModulo[a.modulo_id]) aulasByModulo[a.modulo_id] = [];
      aulasByModulo[a.modulo_id].push(a);
    }

    const built: Modulo[] = (mods ?? []).map((m: any) => ({
      ...m,
      aulas: aulasByModulo[m.id] ?? [],
    }));

    setModulos(built);
    setExpandedModulos(new Set((mods ?? []).map((m: any) => m.id)));

    // Set first lesson active
    const firstAula = built[0]?.aulas[0];
    if (firstAula) setActiveAulaId(firstAula.id);

    // Load progress
    if (user?.id) {
      const allAulaIds = (aulasRaw ?? []).map((a: any) => a.id);
      if (allAulaIds.length) {
        const { data: prog } = await db
          .from("elearning_progresso")
          .select("aula_id")
          .eq("user_id", user.id)
          .eq("completada", true)
          .in("aula_id", allAulaIds);
        setCompleted(new Set((prog ?? []).map((p: any) => p.aula_id)));
      }
    }

    setLoading(false);
  }

  // Flat list of all lessons for prev/next navigation
  const allAulas = modulos.flatMap((m) => m.aulas);
  const currentIdx = allAulas.findIndex((a) => a.id === activeAulaId);
  const currentAula = allAulas[currentIdx] ?? null;
  const prevAula = currentIdx > 0 ? allAulas[currentIdx - 1] : null;
  const nextAula = currentIdx < allAulas.length - 1 ? allAulas[currentIdx + 1] : null;

  const totalAulas = allAulas.length;
  const completedCount = allAulas.filter((a) => completed.has(a.id)).length;
  const progress = totalAulas ? Math.round((completedCount / totalAulas) * 100) : 0;

  async function toggleComplete(aulaId: string) {
    if (!user?.id) return;
    setMarking(true);
    const db = supabase as any;
    const isComplete = completed.has(aulaId);

    if (isComplete) {
      await db.from("elearning_progresso").delete().eq("user_id", user.id).eq("aula_id", aulaId);
      setCompleted((s) => { const n = new Set(s); n.delete(aulaId); return n; });
    } else {
      await db.from("elearning_progresso").upsert({ user_id: user.id, aula_id: aulaId, completada: true, completada_em: new Date().toISOString() }, { onConflict: "user_id,aula_id" });
      setCompleted((s) => new Set([...s, aulaId]));
      if (nextAula) {
        setTimeout(() => setActiveAulaId(nextAula.id), 600);
        toast.success("Aula concluída! Avançando para a próxima.");
      } else {
        toast.success("🎉 Você concluiu todas as aulas deste curso!");
      }
    }
    setMarking(false);
  }

  function toggleModulo(id: string) {
    setExpandedModulos((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Carregando curso…
      </div>
    );
  }

  if (!curso) return null;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col border-r border-border bg-card/60 overflow-y-auto">
        {/* Course header */}
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <Link to="/app/elearning" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" /> Todos os cursos
          </Link>
          <h2 className="font-bold text-sm leading-snug">{curso.titulo}</h2>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{completedCount}/{totalAulas} aulas</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Module/lesson list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {modulos.map((m, mi) => {
            const expanded = expandedModulos.has(m.id);
            const mDone = m.aulas.filter((a) => completed.has(a.id)).length;
            return (
              <div key={m.id}>
                <button
                  onClick={() => toggleModulo(m.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <span className="flex-1 text-left">
                    {mi + 1}. {m.titulo}
                  </span>
                  <span className="text-[10px] font-normal">{mDone}/{m.aulas.length}</span>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {expanded && m.aulas.map((a, ai) => {
                  const active = a.id === activeAulaId;
                  const done = completed.has(a.id);
                  const TypeIcon = a.tipo === "video" ? Play
                    : a.tipo === "pdf" ? FileDown
                    : a.tipo === "link" ? ExternalLink
                    : FileText;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setActiveAulaId(a.id)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all ${
                        active
                          ? "bg-primary/10 border-l-2 border-primary pl-3"
                          : "hover:bg-muted/50 border-l-2 border-transparent pl-3"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground/40"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug line-clamp-2 ${active ? "font-semibold text-primary" : done ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                          {ai + 1}. {a.titulo}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <TypeIcon className="h-2.5 w-2.5 text-muted-foreground/50" />
                          {a.duracao_min > 0 && (
                            <span className="text-[10px] text-muted-foreground/60">{a.duracao_min}min</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {!currentAula ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione uma aula no menu lateral.
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/app/elearning" className="hover:text-foreground transition-colors">E-Learning</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-foreground truncate max-w-[200px]">{curso.titulo}</span>
            </div>

            {/* Lesson title */}
            <div>
              <Badge variant="outline" className="mb-2 text-[10px]">
                {currentAula.tipo === "video" ? "Vídeo" : currentAula.tipo === "pdf" ? "PDF" : currentAula.tipo === "link" ? "Link externo" : "Leitura"}
              </Badge>
              <h1 className="text-xl font-bold tracking-tight">{currentAula.titulo}</h1>
            </div>

            {/* Video / media content */}
            <LessonContent aula={currentAula} />

            {/* Text content */}
            {currentAula.conteudo_html && (
              <div
                className="prose prose-neutral dark:prose-invert max-w-none text-sm
                  prose-headings:font-semibold prose-headings:tracking-tight
                  prose-a:text-primary hover:prose-a:underline
                  prose-img:rounded-lg prose-img:shadow-sm
                  prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-0.5 prose-blockquote:px-2 prose-blockquote:rounded-r-lg"
                dangerouslySetInnerHTML={{ __html: currentAula.conteudo_html }}
              />
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 py-4 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                disabled={!prevAula}
                onClick={() => prevAula && setActiveAulaId(prevAula.id)}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>

              <Button
                size="sm"
                variant={completed.has(currentAula.id) ? "outline" : "default"}
                onClick={() => toggleComplete(currentAula.id)}
                disabled={marking}
                className="gap-2"
              >
                {completed.has(currentAula.id) ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Concluída
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" />
                    Marcar como concluída
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!nextAula}
                onClick={() => nextAula && setActiveAulaId(nextAula.id)}
                className="gap-2"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Completion celebration */}
            {progress === 100 && (
              <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-6 text-center space-y-2">
                <Trophy className="h-10 w-10 text-green-500 mx-auto" />
                <h3 className="font-bold text-green-700 dark:text-green-400">Parabéns! Curso concluído!</h3>
                <p className="text-sm text-green-600 dark:text-green-500">
                  Você completou todas as {totalAulas} aulas de <strong>{curso.titulo}</strong>.
                </p>
                <Link to="/app/elearning">
                  <Button variant="outline" size="sm" className="mt-2 border-green-300 text-green-700 hover:bg-green-100">
                    <BookOpen className="mr-2 h-4 w-4" /> Ver outros cursos
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
