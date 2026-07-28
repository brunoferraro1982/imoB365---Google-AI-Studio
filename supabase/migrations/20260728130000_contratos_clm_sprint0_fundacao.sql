-- CLM Sprint 0 — fundação técnica (débito pré-requisito antes de empilhar o
-- programa de 15 sprints do Contract Lifecycle Management em cima do módulo
-- de contratos existente). Nenhuma mudança de schema aqui é nova feature —
-- são bugs reais já confirmados, corrigidos antes de qualquer coisa nova.

-- 1) contratos RLS não tinha exceção pra financeiro/juridico, inconsistente
-- com contrato_parcelas (que já corrigiu essa classe de bug). Achado real:
-- o papel `juridico` tem escrita liberada no módulo juridico via
-- permissions.ts (matriz de app), mas a RLS só liberava `admin` — um
-- usuário só com papel juridico via UI de escrita e falha ao salvar de
-- verdade. Corrigido estendendo pro mesmo padrão já usado em
-- contrato_parcelas (admin OU financeiro), mais juridico (dono real deste
-- módulo na matriz de permissions.ts).
DROP POLICY IF EXISTS "contratos_admin_write" ON public.contratos;
CREATE POLICY "contratos_admin_write" ON public.contratos
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'juridico')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );

-- 2) O cron de SLA de contratos (verificarSlaContratos / contratos-sla)
-- existe e funciona desde 2026-07-02, mas nunca foi agendado — hoje só
-- roda se alguém clicar manualmente em "Verificar SLA agora" no painel.
-- Mesmo padrão dos outros crons já agendados (inadimplencia, buscas-alertas,
-- visitas-notificacoes, expire-trials).
-- IMPORTANTE: <ANON_OR_PUBLISHABLE_KEY> deve ser substituído pelo valor
-- real de CADA ambiente ao aplicar esta migration.
SELECT cron.schedule(
  'contratos-sla-diario',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/contratos-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
