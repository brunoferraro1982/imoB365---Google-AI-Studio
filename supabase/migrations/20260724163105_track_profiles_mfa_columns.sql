-- Achado durante o fix de "MFA implementado mas nunca exigido no login"
-- (auditoria de segurança de 2026-07-24): `profiles.mfa_exempt` e
-- `profiles.mfa_required` já existiam no schema real de dev e produção
-- (confirmado via REST), mas nunca tiveram uma migration própria — mesmo
-- padrão de drift (objeto criado fora do fluxo normal) já documentado
-- várias vezes no CLAUDE.md para outros objetos. `mfa_exempt` já era
-- citado no CLAUDE.md ("imob365br@gmail.com tem mfa_exempt = TRUE — MFA
-- não é exigido até produção"), mas nenhum código de fato lia essa coluna
-- até agora. Esta migration só formaliza/rastreia o que já existe (por
-- isso IF NOT EXISTS — idempotente, não altera dado real em nenhum
-- ambiente) para que o gate de MFA em src/lib/mfaGate.ts possa consultar
-- `mfa_exempt` com o tipo gerado corretamente, em vez de um cast solto.
-- `mfa_required` fica documentado mas sem nenhum código consumindo ainda
-- (força bruta de matricular MFA por perfil é uma feature maior, fora do
-- escopo deste fix).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false;
