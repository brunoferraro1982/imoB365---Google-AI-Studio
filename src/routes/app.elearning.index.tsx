import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  GraduationCap, Clock, BookOpen, ChevronRight, Trophy, Play, BarChart2, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/app/elearning/")({
  component: ElearningHub,
});

// ─── Types ──────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  imagem_capa_url: string | null;
  nivel: string;
  carga_horaria_min: number;
  status: string;
  ordem: number;
};

type CourseWithProgress = Course & {
  total_aulas: number;
  aulas_concluidas: number;
  progresso: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const NIVEL_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const NIVEL_COLOR: Record<string, string> = {
  iniciante: "bg-green-100 text-green-800 border-green-200",
  intermediario: "bg-yellow-100 text-yellow-800 border-yellow-200",
  avancado: "bg-red-100 text-red-800 border-red-200",
};

function fmtDuracao(min: number) {
  if (!min) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// ─── Component ──────────────────────────────────────────────────────────────

function ElearningHub() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNivel, setFilterNivel] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [user?.id]);

  async function load() {
    setLoading(true);
    const db = supabase as any;

    const { data: rawCourses } = await db
      .from("elearning_cursos")
      .select("id,titulo,slug,descricao,imagem_capa_url,nivel,carga_horaria_min,status,ordem")
      .eq("status", "published")
      .order("ordem", { ascending: true });

    if (!rawCourses || rawCourses.length === 0) {
      setCourses([]);
      setLoading(false);
      return;
    }

    // Load all lessons for progress calculation
    const courseIds = rawCourses.map((c: Course) => c.id);

    const [{ data: modulos }, { data: progresso }] = await Promise.all([
      db
        .from("elearning_modulos")
        .select("id, curso_id")
        .in("curso_id", courseIds),
      user?.id
        ? db
            .from("elearning_progresso")
            .select("aula_id")
            .eq("user_id", user.id)
            .eq("completada", true)
        : Promise.resolve({ data: [] }),
    ]);

    const moduloIds = (modulos ?? []).map((m: any) => m.id);
    const { data: aulas } = moduloIds.length
      ? await db
          .from("elearning_aulas")
          .select("id, modulo_id")
          .in("modulo_id", moduloIds)
      : { data: [] };

    const completedSet = new Set((progresso ?? []).map((p: any) => p.aula_id));

    // Map modulo → curso
    const moduloCurso: Record<string, string> = {};
    for (const m of modulos ?? []) moduloCurso[m.id] = m.curso_id;

    const aulasByCurso: Record<string, string[]> = {};
    for (const a of aulas ?? []) {
      const cid = moduloCurso[a.modulo_id];
      if (cid) {
        if (!aulasByCurso[cid]) aulasByCurso[cid] = [];
        aulasByCurso[cid].push(a.id);
      }
    }

    const result: CourseWithProgress[] = (rawCourses as Course[]).map((c) => {
      const total = (aulasByCurso[c.id] ?? []).length;
      const done = (aulasByCurso[c.id] ?? []).filter((id) => completedSet.has(id)).length;
      return {
        ...c,
        total_aulas: total,
        aulas_concluidas: done,
        progresso: total ? Math.round((done / total) * 100) : 0,
      };
    });

    setCourses(result);
    setLoading(false);
  }

  const filtered = filterNivel
    ? courses.filter((c) => c.nivel === filterNivel)
    : courses;

  const emCurso = courses.filter((c) => c.progresso > 0 && c.progresso < 100);
  const concluidos = courses.filter((c) => c.progresso === 100);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">E-Learning</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Capacitações para corretores e equipes imobiliárias.
          </p>
        </div>

        {/* Quick stats */}
        <div className="hidden md:flex gap-4">
          {[
            { icon: BookOpen, label: "Disponíveis", value: courses.length },
            { icon: BarChart2, label: "Em andamento", value: emCurso.length },
            { icon: Trophy, label: "Concluídos", value: concluidos.length },
          ].map((s) => (
            <div key={s.label} className="text-center border border-border rounded-xl px-4 py-2.5 bg-card min-w-[90px]">
              <s.icon className="h-4 w-4 text-primary mx-auto mb-0.5" />
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Em andamento */}
      {emCurso.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Continuar estudando
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emCurso.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Nível:</span>
        {[null, "iniciante", "intermediario", "avancado"].map((n) => (
          <button
            key={n ?? "all"}
            onClick={() => setFilterNivel(n)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              filterNivel === n
                ? "bg-primary text-white border-primary"
                : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {n ? NIVEL_LABEL[n] : "Todos"}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum curso disponível ainda.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Acesse <strong>Gerenciar cursos</strong> para adicionar ou use o botão de cursos de exemplo.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({ course: c }: { course: CourseWithProgress }) {
  const started = c.progresso > 0;
  const done = c.progresso === 100;

  return (
    <Link
      to="/app/elearning/$cursoId"
      params={{ cursoId: c.id }}
      className="group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200"
    >
      {/* Cover */}
      <div className="relative h-36 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
        {c.imagem_capa_url ? (
          <img
            src={c.imagem_capa_url}
            alt={c.titulo}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <GraduationCap className="h-14 w-14 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-full bg-primary/90 p-3 shadow-lg">
            <Play className="h-5 w-5 text-white fill-white" />
          </div>
        </div>
        {done && (
          <div className="absolute top-2 right-2 rounded-full bg-green-500 p-1.5">
            <Trophy className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${NIVEL_COLOR[c.nivel] ?? "bg-muted text-muted-foreground border-border"}`}>
            {NIVEL_LABEL[c.nivel] ?? c.nivel}
          </span>
          {c.total_aulas > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> {c.total_aulas} aulas
            </span>
          )}
          {c.carga_horaria_min > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDuracao(c.carga_horaria_min)}
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {c.titulo}
        </h3>

        {c.descricao && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{c.descricao}</p>
        )}

        <div className="mt-auto pt-2">
          {c.total_aulas > 0 && (
            <div className="mb-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{done ? "Concluído!" : started ? "Em andamento" : "Não iniciado"}</span>
                <span>{c.progresso}%</span>
              </div>
              <Progress value={c.progresso} className="h-1.5" />
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-semibold text-primary">
              {done ? "Rever curso" : started ? "Continuar" : "Iniciar curso"}
            </span>
            <ChevronRight className="h-4 w-4 text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </div>
        </div>
      </div>
    </Link>
  );
}
