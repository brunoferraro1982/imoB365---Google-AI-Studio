-- Central de Atendimento e Chamados — Sprint 0 (Fundação)
-- Schema base do sistema de chamados omnichannel: dois balcões
-- (imob365 / tenant), roteamento determinístico por contexto — não há
-- heurística de "qual tenant" a resolver aqui, o tenant já é conhecido
-- pelo imóvel/corretor/lead de origem do chamado (resolvido nos sprints
-- de canal/regras de negócio). Chamado sem contexto nenhum cai no balcão
-- imob365 para triagem manual (decisão confirmada com o usuário).

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.chamado_responsavel_tipo AS ENUM ('imob365', 'tenant');
CREATE TYPE public.chamado_solicitante_tipo AS ENUM ('tenant_member', 'cliente_final', 'anonimo');
CREATE TYPE public.chamado_categoria AS ENUM ('problema_plataforma', 'duvida_comercial', 'reclamacao_anuncio', 'financeiro_cobranca', 'outro');
CREATE TYPE public.chamado_canal AS ENUM ('web_chat', 'web_formulario', 'email', 'whatsapp', 'manual');
CREATE TYPE public.chamado_status AS ENUM ('novo', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado');
CREATE TYPE public.chamado_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Sequence pro número humano do chamado (CH-000123), referenciável em
-- e-mail/WhatsApp/assunto pelos canais dos sprints seguintes.
CREATE SEQUENCE public.chamados_numero_seq START 1;

-- =========================================================
-- CHAMADOS (tabela central, único schema para os dois balcões)
-- =========================================================
CREATE TABLE public.chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  responsavel_tipo public.chamado_responsavel_tipo NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  solicitante_tipo public.chamado_solicitante_tipo NOT NULL,
  solicitante_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome text,
  solicitante_email text,
  solicitante_telefone text,
  categoria public.chamado_categoria NOT NULL DEFAULT 'outro',
  canal_origem public.chamado_canal NOT NULL DEFAULT 'web_formulario',
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  assunto text NOT NULL,
  status public.chamado_status NOT NULL DEFAULT 'novo',
  prioridade public.chamado_prioridade NOT NULL DEFAULT 'media',
  atribuido_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_prazo_primeira_resposta timestamptz,
  sla_prazo_resolucao timestamptz,
  primeira_resposta_em timestamptz,
  resolvido_em timestamptz,
  fechado_em timestamptz,
  csat_nota smallint CHECK (csat_nota BETWEEN 1 AND 5),
  csat_comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chamados_tenant ON public.chamados(tenant_id);
CREATE INDEX idx_chamados_responsavel ON public.chamados(responsavel_tipo, status);
CREATE INDEX idx_chamados_atribuido ON public.chamados(atribuido_user_id);
CREATE INDEX idx_chamados_solicitante_user ON public.chamados(solicitante_user_id);

CREATE OR REPLACE FUNCTION public.tg_chamado_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'CH-' || lpad(nextval('public.chamados_numero_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_chamado_numero BEFORE INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.tg_chamado_numero();

CREATE TRIGGER trg_chamados_updated BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- CHAMADO_MENSAGENS (mesmo formato de chat_messages, + nota interna)
-- =========================================================
CREATE TABLE public.chamado_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('cliente', 'agente', 'sistema')),
  autor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  canal public.chamado_canal NOT NULL DEFAULT 'web_chat',
  conteudo text NOT NULL CHECK (char_length(conteudo) <= 4000),
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  interno boolean NOT NULL DEFAULT false,
  whatsapp_message_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chamado_mensagens_chamado ON public.chamado_mensagens(chamado_id, created_at);

-- =========================================================
-- TENANT_ATENDIMENTO_CONFIG (SLA por tenant, mesmo padrão de
-- tenant_lead_settings/tenant_assinatura_config)
-- =========================================================
CREATE TABLE public.tenant_atendimento_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  sla_primeira_resposta_minutos integer NOT NULL DEFAULT 240,
  sla_resolucao_horas integer NOT NULL DEFAULT 48,
  horario_atendimento jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagem_fora_horario text,
  round_robin_ativo boolean NOT NULL DEFAULT true,
  last_assigned_user_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenant_atendimento_config_updated BEFORE UPDATE ON public.tenant_atendimento_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamado_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_atendimento_config ENABLE ROW LEVEL SECURITY;

-- chamados: balcão do tenant — admin/atendente veem tudo do tenant;
-- broker só o que foi atribuído a ele (mesmo espírito de comissoes_members_read).
CREATE POLICY chamados_tenant_read ON public.chamados FOR SELECT TO authenticated
  USING (
    responsavel_tipo = 'tenant' AND tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), tenant_id) AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), tenant_id, 'atendente'::app_role)
      OR (has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role) AND atribuido_user_id = auth.uid())
    )
  );

CREATE POLICY chamados_tenant_update ON public.chamados FOR UPDATE TO authenticated
  USING (
    responsavel_tipo = 'tenant' AND tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), tenant_id) AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), tenant_id, 'atendente'::app_role)
      OR (has_role_in_tenant(auth.uid(), tenant_id, 'broker'::app_role) AND atribuido_user_id = auth.uid())
    )
  )
  WITH CHECK (responsavel_tipo = 'tenant' AND tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), tenant_id));

-- Qualquer usuário autenticado pode abrir um chamado sobre si mesmo
-- (tenant member reportando problema de plataforma à imoB365, ou cliente
-- final logado abrindo um chamado de atendimento em /conta/atendimento).
CREATE POLICY chamados_self_insert ON public.chamados FOR INSERT TO authenticated
  WITH CHECK (solicitante_user_id = auth.uid());

-- Staff do tenant também pode abrir chamados em nome de terceiros
-- (ex.: registrar uma ligação telefônica recebida) — só no próprio balcão.
CREATE POLICY chamados_tenant_staff_insert ON public.chamados FOR INSERT TO authenticated
  WITH CHECK (
    responsavel_tipo = 'tenant' AND tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), tenant_id) AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role)
      OR has_role_in_tenant(auth.uid(), tenant_id, 'atendente'::app_role)
    )
  );

-- chamados: balcão imoB365 — super_admin, cross-tenant (mesmo padrão
-- unscoped de tenants_super_admin_all).
CREATE POLICY chamados_super_admin_all ON public.chamados FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- chamados: cliente final vê os próprios, qualquer balcão.
CREATE POLICY chamados_solicitante_read ON public.chamados FOR SELECT TO authenticated
  USING (solicitante_user_id = auth.uid());

-- chamado_mensagens: segue a visibilidade do chamado pai; nota interna
-- (interno=true) nunca visível pro solicitante.
CREATE POLICY chamado_mensagens_read ON public.chamado_mensagens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c WHERE c.id = chamado_mensagens.chamado_id AND (
        has_role(auth.uid(), 'super_admin'::app_role)
        OR (c.solicitante_user_id = auth.uid() AND NOT chamado_mensagens.interno)
        OR (c.tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), c.tenant_id) AND (
          has_role_in_tenant(auth.uid(), c.tenant_id, 'admin'::app_role)
          OR has_role_in_tenant(auth.uid(), c.tenant_id, 'atendente'::app_role)
          OR (has_role_in_tenant(auth.uid(), c.tenant_id, 'broker'::app_role) AND c.atribuido_user_id = auth.uid())
        ))
      )
    )
  );

CREATE POLICY chamado_mensagens_insert ON public.chamado_mensagens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chamados c WHERE c.id = chamado_mensagens.chamado_id AND (
        has_role(auth.uid(), 'super_admin'::app_role)
        OR c.solicitante_user_id = auth.uid()
        OR (c.tenant_id IS NOT NULL AND is_member_of_tenant(auth.uid(), c.tenant_id) AND (
          has_role_in_tenant(auth.uid(), c.tenant_id, 'admin'::app_role)
          OR has_role_in_tenant(auth.uid(), c.tenant_id, 'atendente'::app_role)
          OR (has_role_in_tenant(auth.uid(), c.tenant_id, 'broker'::app_role) AND c.atribuido_user_id = auth.uid())
        ))
      )
    )
  );

-- tenant_atendimento_config: mesmo padrão de tenant_lead_settings.
CREATE POLICY tac_members_read ON public.tenant_atendimento_config FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY tac_admin_write ON public.tenant_atendimento_config FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
CREATE POLICY tac_super_admin_all ON public.tenant_atendimento_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- GRANTs explícitos pros três roles — lição operacional de 2026-07-25/28
-- (tabela nova aplicada fora do fluxo Studio/CLI nunca herda o default ACL
-- implícito deste self-host): nunca confiar nisso, declarar sempre.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chamados TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chamado_mensagens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_atendimento_config TO anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE public.chamados_numero_seq TO anon, authenticated, service_role;

-- Auditoria (mesmo padrão de tg_audit() já usado no programa CLM).
CREATE TRIGGER tg_audit_chamados AFTER INSERT OR UPDATE OR DELETE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER tg_audit_chamado_mensagens AFTER INSERT OR UPDATE OR DELETE ON public.chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER tg_audit_tenant_atendimento_config AFTER INSERT OR UPDATE OR DELETE ON public.tenant_atendimento_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- =========================================================
-- Catálogo de módulos: registra 'atendimento' e inclui no
-- provisionamento automático de TODOS os planos (tier 0 baseline, mesmo
-- grupo de imobiliario/ajustes) — ticketing básico é grátis pra todo
-- tenant; SLA customizável/IA/relatórios avançados ficam atrás de plano
-- pago num sprint futuro (app-layer gate, mesmo padrão de PLANOS_COM_ACESSO
-- já usado em captacao.ts — não é um gate de módulo inteiro).
--
-- core=true é obrigatório aqui: tg_enforce_modules_quota() (trigger BEFORE
-- INSERT em tenant_modules, 20260715100000) bloqueia módulos não-core
-- acima da cota do plano ("Cota de módulos do plano atingida") — um tenant
-- free/basic já no teto de módulos não poderia receber 'atendimento' como
-- baseline sem essa flag. imobiliario/ajustes contam com o mesmo bypass.
INSERT INTO public.modules (slug, nome, descricao, requires_plan, core)
VALUES ('atendimento', 'Central de Atendimento', 'Chamados omnichannel (web, e-mail, WhatsApp)', NULL, true)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.provision_tenant_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tier int;
  wanted text[];
  hi text[] := array['imobiliario','ajustes','financeiro','juridico','marketing','elearning','atendimento'];
BEGIN
  tier := CASE COALESCE(NEW.plano_slug,'free')
            WHEN 'free' THEN 0 WHEN 'basic' THEN 1 WHEN 'standard' THEN 2
            WHEN 'pro' THEN 3 WHEN 'business' THEN 4 ELSE 0 END;
  wanted := array['imobiliario','ajustes','atendimento'];
  IF tier >= 2 THEN wanted := wanted || 'financeiro'::text; END IF;
  IF tier >= 3 THEN wanted := wanted || array['juridico','marketing']; END IF;
  IF tier >= 4 THEN wanted := wanted || 'elearning'::text; END IF;

  INSERT INTO public.tenant_modules (tenant_id, module_slug, enabled)
  SELECT NEW.id, w, true FROM unnest(wanted) w
  WHERE NOT EXISTS (SELECT 1 FROM public.tenant_modules tm
                    WHERE tm.tenant_id = NEW.id AND tm.module_slug = w);

  UPDATE public.tenant_modules SET enabled = true
   WHERE tenant_id = NEW.id AND module_slug = ANY(wanted);

  UPDATE public.tenant_modules SET enabled = false
   WHERE tenant_id = NEW.id AND module_slug = ANY(hi) AND NOT (module_slug = ANY(wanted));

  RETURN NEW;
END;
$$;

-- Backfill: provisiona 'atendimento' pra todos os tenants já existentes —
-- o trigger acima só dispara em INSERT/UPDATE de plano_slug futuro.
INSERT INTO public.tenant_modules (tenant_id, module_slug, enabled)
SELECT id, 'atendimento', true FROM public.tenants
ON CONFLICT (tenant_id, module_slug) DO UPDATE SET enabled = true;
