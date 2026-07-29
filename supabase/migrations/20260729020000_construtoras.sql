-- Construtoras — diretório curado pelo super_admin (fonte de negócio real:
-- vitrine no rodapé + seleção confiável no cadastro de empreendimento, hoje
-- só um campo de texto livre `empreendimentos.construtora`, sem integridade
-- referencial, gerando duplicidade por digitação).
--
-- Decisão de escopo confirmada com o usuário: só o super_admin cadastra
-- construtoras e atribui imobiliárias parceiras nesta fase — a própria
-- construtora não tem login, e imobiliária/corretor não gerenciam nada
-- disso, só enxergam (leitura) e selecionam a construtora já cadastrada
-- no formulário de empreendimento.
--
-- `status`/`criado_por` em construtora_tenant_parceria e `user_id` em
-- construtoras já preparam uma V2 onde a construtora ganha login próprio
-- e conduz um fluxo de convite/aceite (mesmo padrão de parcerias_convites,
-- 20260713140000) — no V1 só se escreve 'ativo'/'super_admin'/NULL.

CREATE TABLE public.construtoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  cnpj text,
  telefone text,
  email text,
  site text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  logo_url text,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  exibir_no_rodape boolean NOT NULL DEFAULT false,
  user_id uuid, -- reservado pra V2 (login próprio da construtora); sempre NULL no V1
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER construtoras_upd BEFORE UPDATE ON public.construtoras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.construtoras ENABLE ROW LEVEL SECURITY;

-- Dado de contato de empresa é informação pública por natureza (mesmo
-- espírito de corretores públicos) — sem necessidade de granularidade
-- extra além de ativo=true.
CREATE POLICY construtoras_read ON public.construtoras FOR SELECT TO anon, authenticated
  USING (ativo = true);

CREATE POLICY construtoras_super_admin_all ON public.construtoras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- GRANT explícito nas 3 roles já na própria migration — lição operacional
-- já documentada (tabela aplicada via psql direto por SSH nunca herda o
-- GRANT automático que o self-host dá por padrão via Studio/CLI).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtoras TO anon, authenticated, service_role;

CREATE TABLE public.construtora_tenant_parceria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construtora_id uuid NOT NULL REFERENCES public.construtoras(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pendente', 'recusado')),
  criado_por text NOT NULL DEFAULT 'super_admin' CHECK (criado_por IN ('super_admin', 'construtora', 'tenant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (construtora_id, tenant_id)
);

CREATE INDEX ON public.construtora_tenant_parceria(tenant_id);

CREATE TRIGGER construtora_tenant_parceria_upd BEFORE UPDATE ON public.construtora_tenant_parceria
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.construtora_tenant_parceria ENABLE ROW LEVEL SECURITY;

CREATE POLICY parceria_tenant_read ON public.construtora_tenant_parceria FOR SELECT TO authenticated
  USING (is_member_of_tenant(auth.uid(), tenant_id));

CREATE POLICY parceria_super_admin_all ON public.construtora_tenant_parceria FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtora_tenant_parceria TO anon, authenticated, service_role;

-- Mantém empreendimentos.construtora/cnpj_construtora (texto livre)
-- intactos como fallback de exibição pra registros antigos ainda não
-- migrados — não é preciso backfill automático agora.
ALTER TABLE public.empreendimentos
  ADD COLUMN construtora_id uuid REFERENCES public.construtoras(id) ON DELETE SET NULL;

CREATE INDEX ON public.empreendimentos(construtora_id);

-- Storage: bucket público de logos de construtora — path
-- {construtora_id}/{uuid}.{ext}, não é tenant-scoped (construtora não
-- pertence a um tenant). Bucket + as 4 policies já na mesma migration,
-- evitando o bug recorrente já documentado (bucket que nasce só com
-- policy de leitura).
INSERT INTO storage.buckets (id, name, public)
VALUES ('construtora-logos', 'construtora-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "construtora-logos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'construtora-logos');

CREATE POLICY "construtora-logos super_admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'construtora-logos' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "construtora-logos super_admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'construtora-logos' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "construtora-logos super_admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'construtora-logos' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Auditoria — mesmo padrão já usado nas demais tabelas novas do projeto.
CREATE TRIGGER tg_audit_construtoras AFTER INSERT OR UPDATE OR DELETE ON public.construtoras
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE TRIGGER tg_audit_construtora_tenant_parceria AFTER INSERT OR UPDATE OR DELETE ON public.construtora_tenant_parceria
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
