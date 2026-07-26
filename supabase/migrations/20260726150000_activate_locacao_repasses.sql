-- Fase 1 do incremento do módulo Financeiro (repasse ao proprietário):
-- locacao_repasses existia desde 20260521191240 mas nunca teve rota/UI —
-- ao ativar pra uso real, corrige o mesmo gap de RLS já achado e corrigido
-- em lancamentos_financeiros na auditoria de 2026-07-24 (leitura/escrita
-- liberada pra qualquer membro do tenant, sem checar papel; deveria exigir
-- admin ou financeiro, mesmo padrão hoje usado em lancamentos_financeiros).

-- Achado real ao testar a tela de repasses: contratos.imovel_id nunca teve
-- FK pra imoveis(id) — mesma causa raiz já corrigida antes em
-- favoritos.imovel_id e visitas.imovel_id (ver changelog 2026-07-20).
-- PostgREST não resolvia o embed `imovel:imoveis(...)` a partir de
-- contratos (erro PGRST200 "Could not find a relationship"), quebrando a
-- listagem de repasses (que precisa mostrar qual imóvel cada repasse é).
-- ON DELETE SET NULL (não CASCADE): apagar um imóvel não deveria apagar o
-- contrato/histórico financeiro associado a ele.
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_imovel_id_fkey
  FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "lr_read" ON public.locacao_repasses;
CREATE POLICY "lr_read" ON public.locacao_repasses
  FOR SELECT TO authenticated
  USING (
    is_member_of_tenant(auth.uid(), tenant_id)
    AND (
      has_role_in_tenant(auth.uid(), tenant_id, 'admin')
      OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
    )
  );

DROP POLICY IF EXISTS "lr_admin" ON public.locacao_repasses;
CREATE POLICY "lr_admin" ON public.locacao_repasses
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'financeiro')
  );

-- Geração mensal automática (dia 1, 06:00 UTC) do repasse do mês corrente
-- pra todo contrato de locação ativo — ver src/lib/locacaoRepasses.ts e
-- src/routes/api.public.cron.gerar-repasses.ts.
--
-- IMPORTANTE: <ANON_OR_PUBLISHABLE_KEY> abaixo é placeholder de propósito
-- (chave pública/anon do projeto, não é segredo — mas colar o valor real
-- aqui dispara o Gitleaks do CI como "generic-api-key" por entropia alta).
-- Ao aplicar esta migration em cada ambiente (dev via Studio, produção via
-- psql), substituir pela chave real daquele ambiente antes de rodar — dev
-- e produção têm chaves diferentes, e produção já usa o formato novo
-- sb_publishable_..., não o JWT antigo (ver changelog 2026-07-24 "apikey
-- no formato antigo" pra contexto do mesmo erro já cometido antes aqui).
SELECT cron.schedule(
  'gerar-repasses-mensal',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://portal.imob365.com.br/api/public/cron/gerar-repasses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
