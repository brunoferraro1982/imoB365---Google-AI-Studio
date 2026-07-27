-- Status page & monitoramento de infraestrutura (v1) — motivado pelos dois
-- incidentes reais de 2026-07-27 (deploy SSH flaky, Ollama vazando memória
-- + 504 do nginx). Catálogo de serviços monitorados + histórico bruto de
-- checagens (fonte pra faixa de "últimos 90 dias" na UI) + incidentes
-- gerenciados manualmente pelo super_admin (sem auto-detecção nesta v1).
--
-- `status_checks.source` já reserva o valor 'external' — ponto de extensão
-- pra quando uma ferramenta externa (Zabbix, Datadog) passar a alimentar
-- checagens também, sem precisar de migration nova nesse dia.

CREATE TABLE public.status_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome_exibicao text NOT NULL,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  publico boolean NOT NULL DEFAULT true,
  link_gerenciamento text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.status_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.status_services(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('operational', 'degraded', 'outage')),
  latency_ms int,
  mensagem text,
  source text NOT NULL DEFAULT 'cron' CHECK (source IN ('cron', 'manual', 'external')),
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_checks_service_time ON public.status_checks(service_id, checked_at DESC);

CREATE TABLE public.status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  status text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  impacto text NOT NULL CHECK (impacto IN ('minor', 'major', 'critical')),
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.status_incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_incident_updates_incident ON public.status_incident_updates(incident_id, created_at);

CREATE TABLE public.status_incident_services (
  incident_id uuid NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.status_services(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, service_id)
);

ALTER TABLE public.status_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incident_services ENABLE ROW LEVEL SECURITY;

-- Leitura pública em todas (a /status precisa ser lida por visitante não
-- logado) — a distinção "aparece no /status" vs "só no /admin" é feita pela
-- coluna `publico`, filtrada na query da página pública, não na RLS (não é
-- um limite de confidencialidade, é só de exibição). Escrita restrita a
-- super_admin, mesmo padrão (uma policy por verbo, sem TO explícito) já
-- usado em plan_features/plan_modules — a própria checagem automática grava
-- via supabaseAdmin (service role, ignora RLS).
CREATE POLICY "status_services_public_read" ON public.status_services FOR SELECT USING (true);
CREATE POLICY "status_services_super_admin_write" ON public.status_services FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_services_super_admin_update" ON public.status_services FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_services_super_admin_delete" ON public.status_services FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "status_checks_public_read" ON public.status_checks FOR SELECT USING (true);
CREATE POLICY "status_checks_super_admin_write" ON public.status_checks FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_checks_super_admin_delete" ON public.status_checks FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "status_incidents_public_read" ON public.status_incidents FOR SELECT USING (true);
CREATE POLICY "status_incidents_super_admin_write" ON public.status_incidents FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_incidents_super_admin_update" ON public.status_incidents FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_incidents_super_admin_delete" ON public.status_incidents FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "status_incident_updates_public_read" ON public.status_incident_updates FOR SELECT USING (true);
CREATE POLICY "status_incident_updates_super_admin_write" ON public.status_incident_updates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "status_incident_services_public_read" ON public.status_incident_services FOR SELECT USING (true);
CREATE POLICY "status_incident_services_super_admin_write" ON public.status_incident_services FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "status_incident_services_super_admin_delete" ON public.status_incident_services FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- GRANT explícito, sempre — lição já documentada (ALTER DEFAULT PRIVILEGES
-- do self-host só cobre objetos criados pela role `postgres`, não por
-- `supabase_admin` via psql direto).
GRANT SELECT ON public.status_services, public.status_checks, public.status_incidents,
  public.status_incident_updates, public.status_incident_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.status_services, public.status_checks, public.status_incidents,
  public.status_incident_updates, public.status_incident_services TO authenticated;

-- Catálogo inicial (v1) — editável depois via /admin/status, não hardcoded
-- no código. `link_gerenciamento` só quando existe UI real de gestão.
INSERT INTO public.status_services (slug, nome_exibicao, descricao, ordem, link_gerenciamento) VALUES
('app', 'Aplicação (imoB365)', 'Backend, portal público e área logada.', 1, null),
('database', 'Banco de Dados', 'Postgres e API de dados (PostgREST).', 2, null),
('auth', 'Autenticação', 'Login, cadastro e recuperação de senha.', 3, null),
('storage', 'Armazenamento de Arquivos', 'Fotos de imóveis, logos e documentos.', 4, null),
('realtime', 'Tempo Real', 'Chat e notificações ao vivo.', 5, null),
('ai-assistant', 'Assistente de IA', 'Assistente de perguntas e respostas dentro da plataforma.', 6, null);

-- Roda a cada 5 minutos, cadência padrão de status page sem sobrecarregar a
-- VPS (ver src/routes/api.public.cron.status-check.ts).
-- IMPORTANTE: <ANON_OR_PUBLISHABLE_KEY> deve ser substituído pelo valor
-- real de CADA ambiente ao aplicar esta migration.
SELECT cron.schedule(
  'status-check-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/status-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Limpeza diária das checagens além dos 90 dias de retenção (ver
-- src/routes/api.public.cron.status-cleanup.ts).
SELECT cron.schedule(
  'status-cleanup-diario',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/status-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
