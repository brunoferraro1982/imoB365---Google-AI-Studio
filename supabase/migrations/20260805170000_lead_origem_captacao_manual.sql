-- Importação manual assistida do Facebook Marketplace (corretor cola o link
-- + texto do anúncio, sem nenhuma automação tocando o Facebook) precisa de
-- um valor de origem próprio, distinto de 'captacao_automatica' (que é o
-- robô cron da Chaves na Mão) — evita relatório confundir lead manual com
-- automatizado.
--
-- Precisa ser migration própria e separada: Postgres não permite usar um
-- valor novo de enum na mesma transação em que ele foi adicionado (mesma
-- restrição já documentada em 20260724192053_add_lead_origem_captacao_automatica.sql).
ALTER TYPE public.lead_origem ADD VALUE IF NOT EXISTS 'captacao_manual';
