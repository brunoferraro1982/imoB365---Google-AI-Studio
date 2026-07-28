-- CLM Sprint 1 — Cadastro do Contrato: cobre os tipos e situações pedidos
-- que ainda faltavam no enum (venda/locacao/permuta/outro/parceria/
-- administracao/prestacao_servico já existiam; exclusividade/captacao não).
--
-- ALTER TYPE ... ADD VALUE é aditivo e seguro — nenhum contrato existente
-- muda de tipo/status, e os triggers já existentes (tg_gerar_comissao_
-- contrato, tg_gerar_parcelas_contrato) continuam disparando exatamente
-- como antes (eles checam por 'ativo', que não muda).
ALTER TYPE contrato_tipo ADD VALUE IF NOT EXISTS 'exclusividade';
ALTER TYPE contrato_tipo ADD VALUE IF NOT EXISTS 'captacao';

-- 'rescindido' separa "contrato que vigorou e foi rescindido" de
-- 'cancelado' (hoje usado tanto pra isso quanto pra "nunca chegou a
-- vigorar") — melhoria de dado pedida explicitamente no brief do CLM.
-- Contratos já cancelados hoje continuam 'cancelado' (nenhum backfill —
-- não temos como saber retroativamente qual dos dois motivos se aplica a
-- cada um; a partir de agora a UI passa a distinguir os dois na criação).
ALTER TYPE contrato_status ADD VALUE IF NOT EXISTS 'rescindido';
