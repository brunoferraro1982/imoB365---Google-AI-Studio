-- payment_events só guarda o corpo bruto da notificação webhook do Mercado
-- Pago (ex.: {action, data:{id}, type, ...}) — não contém o valor cobrado
-- (o MP manda só "algo mudou, busque pelo id"). Para a tela de Faturas do
-- painel de super_admin mostrar valores reais sem repetir chamadas à API do
-- MP a cada carregamento, o webhook passa a gravar o valor no momento em que
-- já busca o recurso (preapproval/payment) para processar a notificação.
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS amount   numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
