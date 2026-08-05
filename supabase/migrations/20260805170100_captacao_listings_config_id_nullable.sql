-- Importação manual (Facebook Marketplace) grava em captacao_listings sem
-- ter uma "busca configurada" (captacao_configs) por trás — só existe pro
-- robô automatizado (Chaves na Mão). Relaxa a FK pra permitir config_id NULL
-- nesse caso, mantendo NOT NULL implícito pra quem já tem config (o robô
-- continua sempre preenchendo).
ALTER TABLE public.captacao_listings ALTER COLUMN config_id DROP NOT NULL;
