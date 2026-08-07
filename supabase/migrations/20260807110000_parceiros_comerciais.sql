-- Parceiros Comerciais: rastreamento de prospecção B2B do corretor com
-- construtoras, incorporadoras, redes de imobiliárias e portais — buscando
-- parcerias (alocação de unidades, indicação de leads). Diferente de
-- `leads` (comprador final de imóvel), de `/app/parcerias` (co-corretagem
-- entre tenants, tabelas parcerias_convites/parcerias_settings) e de
-- `construtoras` (diretório público curado pelo super_admin).

-- parceiro_etapas primeiro (ordem de FK). Espelha roteiro_visita_etapas
-- (supabase/migrations/20260806110000_roteiro_visitas.sql) exatamente —
-- mesmo padrão de etapas configuráveis por tenant já validado no projeto.
CREATE TABLE public.parceiro_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parceiro_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parceiro_etapas members read" ON public.parceiro_etapas
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY "parceiro_etapas admin write" ON public.parceiro_etapas
  FOR INSERT TO authenticated
  WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "parceiro_etapas admin update" ON public.parceiro_etapas
  FOR UPDATE TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "parceiro_etapas admin delete" ON public.parceiro_etapas
  FOR DELETE TO authenticated
  USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "parceiro_etapas super_admin all" ON public.parceiro_etapas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_etapas TO authenticated;

-- nome_empresa OU nome_contato (exemplos reais de uso têm linhas só com
-- nome de pessoa, sem empresa identificada ainda).
CREATE TABLE public.parceiros_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome_empresa text,
  nome_contato text,
  tipo text NOT NULL DEFAULT 'construtora', -- construtora|imobiliaria|portal|outro
  cargo text,
  telefone text,
  email text,
  canal_contato text, -- whatsapp|email|telefone|formulario|presencial
  observacoes text,
  etapa_id uuid REFERENCES public.parceiro_etapas(id) ON DELETE SET NULL,
  corretor_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parceiros_comerciais_nome_check CHECK (nome_empresa IS NOT NULL OR nome_contato IS NOT NULL)
);

ALTER TABLE public.parceiros_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parceiros_comerciais members read" ON public.parceiros_comerciais
  FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

-- Qualquer corretor da equipe pode logar/editar contato com parceiros
-- (não só admin) — mesmo espírito de leads_admin_write, mas auto-contido
-- nesta migration (sem depender de policy legada de outra tabela).
CREATE POLICY "parceiros_comerciais broker write" ON public.parceiros_comerciais
  FOR ALL TO authenticated
  USING (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker')
  )
  WITH CHECK (
    has_role_in_tenant(auth.uid(), tenant_id, 'admin')
    OR has_role_in_tenant(auth.uid(), tenant_id, 'broker')
  );

CREATE POLICY "parceiros_comerciais super_admin all" ON public.parceiros_comerciais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_comerciais TO authenticated;

-- Reaproveita lead_tarefas (já poligmórfica: lead_id/contrato_id/
-- cartorio_registro_id/chamado_id, todos nullable com um CHECK exigindo
-- pelo menos um) em vez de criar uma tabela de tarefas nova.
ALTER TABLE public.lead_tarefas
  ADD COLUMN parceiro_id uuid REFERENCES public.parceiros_comerciais(id) ON DELETE CASCADE;

-- O botão "Nova Tarefa" em /app/tarefas cria tarefas avulsas (lembrete
-- pessoal do corretor, sem vínculo nenhum) além de tarefas vinculadas a um
-- parceiro comercial — o CHECK "pelo menos uma origem preenchida" deixa de
-- fazer sentido (não existe mais um fluxo que só cria tarefa a partir de
-- uma dessas 5 entidades; agora a criação também pode ser 100% livre).
ALTER TABLE public.lead_tarefas DROP CONSTRAINT IF EXISTS lead_tarefas_origem_check;
