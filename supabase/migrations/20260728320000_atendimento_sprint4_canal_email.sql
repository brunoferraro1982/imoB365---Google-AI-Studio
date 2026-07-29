-- Central de Atendimento — Sprint 4 (Canal E-mail)
--
-- Correção de arquitetura em relação ao plano original: imoB365 é
-- prestadora de serviço, não centraliza a operação de canais em nome do
-- tenant (princípio confirmado explicitamente pelo usuário, registrado em
-- memória — "imob365-tenant-autonomy-byo-credentials"). Não existe uma
-- caixa de e-mail única "atendimento@imob365.com.br" operada pela
-- plataforma: cada tenant (imobiliária/corretor) conecta a própria conta
-- de e-mail (SMTP/IMAP), e a própria imoB365 (Tenant 0) configura o
-- próprio balcão pelo mesmo mecanismo, sem caso especial — mesmo padrão
-- BYO já usado em tenant_assinatura_config (CLM Sprint 9).
--
-- Achado real durante este sprint: o mecanismo enqueue_email/pgmq (via
-- /lovable/email/queue/process.ts) é infraestrutura Lovable herdada,
-- exige LOVABLE_API_KEY e nunca foi ligado ao SMTP real da Hostinger —
-- reaproveitá-lo silenciosamente resultaria em e-mails nunca enviados de
-- verdade. Por isso este sprint não usa enqueue_email; o envio é feito
-- diretamente via SMTP (nodemailer) com a credencial do próprio tenant.

CREATE TABLE public.tenant_atendimento_canal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  ativo boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, canal)
);

CREATE TRIGGER trg_tenant_atendimento_canal_config_updated
  BEFORE UPDATE ON public.tenant_atendimento_canal_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.tenant_atendimento_canal_config ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de tenant_assinatura_config: admin-only, sem policy de
-- leitura de membro comum — a linha guarda credencial (SMTP/IMAP em texto
-- plano, mesmo trade-off já aceito ali; não existe infra de criptografia
-- no projeto hoje).
CREATE POLICY tacc_admin ON public.tenant_atendimento_canal_config
  FOR ALL TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'::app_role));
CREATE POLICY tacc_super_admin_all ON public.tenant_atendimento_canal_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_atendimento_canal_config
  TO anon, authenticated, service_role;

CREATE TRIGGER tg_audit_tenant_atendimento_canal_config
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_atendimento_canal_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
