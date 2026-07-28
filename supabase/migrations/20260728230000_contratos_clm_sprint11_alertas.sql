-- CLM Sprint 11 — Alertas: segue o Sprint 8 (Gestão Documental), que criou
-- contrato_documentos sem coluna de validade — necessária agora pro alerta
-- de "documento expirado" (RG/CNH com data de vencimento).
ALTER TABLE public.contrato_documentos
  ADD COLUMN IF NOT EXISTS validade date;
