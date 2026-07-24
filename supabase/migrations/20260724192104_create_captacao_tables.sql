-- Robô de captação automática de imóveis: cada tenant configura sua própria
-- busca (cidade/tipo/finalidade/faixa de preço) contra a Chaves na Mão,
-- rodando em ciclos configuráveis (8h/12h/24h/48h). Leads capturados caem
-- direto no funil normal do tenant (leads.origem = 'captacao_automatica').
-- Captação é privada por tenant — sem pool global entre imobiliárias.

CREATE TABLE public.captacao_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cidade text NOT NULL,
  uf text NOT NULL,
  bairro text,
  tipo text NOT NULL DEFAULT 'apartamento',
  finalidade text NOT NULL DEFAULT 'venda' CHECK (finalidade IN ('venda', 'aluguel')),
  preco_min numeric(12, 2),
  preco_max numeric(12, 2),
  intervalo_horas integer NOT NULL DEFAULT 24 CHECK (intervalo_horas IN (8, 12, 24, 48)),
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_captacao_configs_tenant ON public.captacao_configs (tenant_id);
CREATE INDEX idx_captacao_configs_ativo_execucao ON public.captacao_configs (ativo, ultima_execucao);

CREATE TABLE public.captacao_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES public.captacao_configs(id) ON DELETE CASCADE,
  fonte text NOT NULL DEFAULT 'chavesnamao',
  external_id text NOT NULL,
  url text NOT NULL,
  dados_brutos jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  primeira_vez_visto_em timestamptz NOT NULL DEFAULT now(),
  ultima_vez_visto_em timestamptz NOT NULL DEFAULT now(),
  indisponivel_desde timestamptz,
  UNIQUE (tenant_id, fonte, external_id)
);

CREATE INDEX idx_captacao_listings_tenant ON public.captacao_listings (tenant_id);
CREATE INDEX idx_captacao_listings_recheck
  ON public.captacao_listings (ultima_vez_visto_em)
  WHERE indisponivel_desde IS NULL;

ALTER TABLE public.captacao_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captacao_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "captacao_configs_members_read" ON public.captacao_configs
  FOR SELECT
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY "captacao_configs_admin_write" ON public.captacao_configs
  FOR ALL
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker')
  );

CREATE POLICY "captacao_configs_super_admin_all" ON public.captacao_configs
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "captacao_listings_members_read" ON public.captacao_listings
  FOR SELECT
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY "captacao_listings_super_admin_all" ON public.captacao_listings
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Sem policy de INSERT/UPDATE pra membros comuns do tenant em
-- captacao_listings de propósito: só a engine do robô (supabaseAdmin,
-- service role, bypassa RLS) escreve nessa tabela.

-- pg_cron: dispara a rota de despacho de hora em hora. A rota decide,
-- por config, se já passou o intervalo configurado (intervalo_horas +
-- ultima_execucao) — o mesmo padrão de watermark já usado em
-- buscas_salvas.ultimo_envio — em vez de reagendar o cron dinamicamente
-- (que exigiria privilégio elevado de cron.schedule() a partir do app).
-- apikey abaixo é a publishable key de DEV (Supabase Cloud) — segue o
-- mesmo padrão já usado nos outros cron.schedule() deste repo (a chave
-- de produção diverge por já ter sido re-rotacionada lá, ver changelog
-- de 2026-07-21 "apikey no formato antigo" — aplicar com a chave real
-- de cada ambiente ao rodar esta migration, não só copiar o valor daqui).
SELECT cron.schedule(
  'captacao-automatica-horaria',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/captacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_G_p9ez_FoDl9h89x2_gGTA_F0hws2Uw'
    ),
    body := '{}'::jsonb
  );
  $$
);
