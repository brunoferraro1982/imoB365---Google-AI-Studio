-- CLM Sprint 2 — Participantes: cobre os papéis pedidos que faltavam no
-- enum parte_papel (o bug de UI vs enum já foi corrigido no Sprint 0,
-- restringindo o dropdown ao que já existia — agora testemunha/corretor
-- viram valores reais, mais advogado/administrador que nunca existiram em
-- lugar nenhum) + campos de qualificação/participação por parte + status de
-- assinatura por participante (hoje só existe um campo global em
-- contratos, incapaz de expressar "locador já assinou, locatário não").
ALTER TYPE parte_papel ADD VALUE IF NOT EXISTS 'testemunha';
ALTER TYPE parte_papel ADD VALUE IF NOT EXISTS 'corretor';
ALTER TYPE parte_papel ADD VALUE IF NOT EXISTS 'advogado';
ALTER TYPE parte_papel ADD VALUE IF NOT EXISTS 'administrador';

ALTER TABLE public.contrato_partes
  ADD COLUMN IF NOT EXISTS percentual_participacao numeric,
  ADD COLUMN IF NOT EXISTS responsabilidade text,
  ADD COLUMN IF NOT EXISTS assinatura_status text NOT NULL DEFAULT 'pendente'
    CHECK (assinatura_status IN ('pendente', 'enviado', 'assinado')),
  ADD COLUMN IF NOT EXISTS nacionalidade text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS endereco text;

-- Auditoria de contrato_partes — gap real encontrado na investigação: o
-- contrato-pai já é auditado desde sempre (tg_audit_contratos), mas
-- alterações em participantes nunca deixavam rastro. Mesma função genérica
-- tg_audit(), já criada e usada por 9 outras tabelas — só falta o trigger.
DROP TRIGGER IF EXISTS tg_audit_contrato_partes ON public.contrato_partes;
CREATE TRIGGER tg_audit_contrato_partes
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_partes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
