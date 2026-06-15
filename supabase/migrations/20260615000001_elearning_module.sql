-- E-Learning module tables
-- Courses, Modules, Lessons, Progress tracking

CREATE TABLE IF NOT EXISTS elearning_cursos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  descricao        text,
  imagem_capa_url  text,
  nivel            text        NOT NULL DEFAULT 'iniciante', -- iniciante | intermediario | avancado
  carga_horaria_min integer    NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft',     -- draft | published
  ordem            integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elearning_modulos (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id  uuid        NOT NULL REFERENCES elearning_cursos(id) ON DELETE CASCADE,
  titulo    text        NOT NULL,
  descricao text,
  ordem     integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elearning_aulas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id     uuid        NOT NULL REFERENCES elearning_modulos(id) ON DELETE CASCADE,
  titulo        text        NOT NULL,
  tipo          text        NOT NULL DEFAULT 'video', -- video | texto | pdf | link
  conteudo_html text,
  video_url     text,
  arquivo_url   text,
  link_externo  text,
  duracao_min   integer     NOT NULL DEFAULT 5,
  ordem         integer     NOT NULL DEFAULT 0,
  gratuita      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elearning_progresso (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id       uuid        NOT NULL REFERENCES elearning_aulas(id) ON DELETE CASCADE,
  completada    boolean     NOT NULL DEFAULT true,
  completada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, aula_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_elearning_modulos_curso   ON elearning_modulos(curso_id);
CREATE INDEX IF NOT EXISTS idx_elearning_aulas_modulo    ON elearning_aulas(modulo_id);
CREATE INDEX IF NOT EXISTS idx_elearning_progresso_user  ON elearning_progresso(user_id);
CREATE INDEX IF NOT EXISTS idx_elearning_progresso_aula  ON elearning_progresso(aula_id);

-- RLS
ALTER TABLE elearning_cursos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_modulos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_aulas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_progresso ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published courses and their content
CREATE POLICY "elearning_cursos_read"    ON elearning_cursos    FOR SELECT TO authenticated USING (true);
CREATE POLICY "elearning_cursos_write"   ON elearning_cursos    FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "elearning_modulos_read"   ON elearning_modulos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "elearning_modulos_write"  ON elearning_modulos   FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "elearning_aulas_read"     ON elearning_aulas     FOR SELECT TO authenticated USING (true);
CREATE POLICY "elearning_aulas_write"    ON elearning_aulas     FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "elearning_progresso_self" ON elearning_progresso FOR ALL    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
