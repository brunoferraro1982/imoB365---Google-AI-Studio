
-- ============== FUNIS / ETAPAS / SCORING / CADÊNCIAS ==============
CREATE TABLE public.lead_funis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_funis(tenant_id);
ALTER TABLE public.lead_funis ENABLE ROW LEVEL SECURITY;
CREATE POLICY lf_read ON public.lead_funis FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lf_admin ON public.lead_funis FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lf_upd BEFORE UPDATE ON public.lead_funis FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.lead_funil_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funil_id uuid NOT NULL REFERENCES public.lead_funis(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text,
  sla_horas integer,
  is_ganho boolean NOT NULL DEFAULT false,
  is_perdido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_funil_etapas(funil_id, ordem);
ALTER TABLE public.lead_funil_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lfe_read ON public.lead_funil_etapas FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lfe_admin ON public.lead_funil_etapas FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lfe_upd BEFORE UPDATE ON public.lead_funil_etapas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.leads
  ADD COLUMN funil_id uuid REFERENCES public.lead_funis(id) ON DELETE SET NULL,
  ADD COLUMN etapa_id uuid REFERENCES public.lead_funil_etapas(id) ON DELETE SET NULL,
  ADD COLUMN score integer NOT NULL DEFAULT 0,
  ADD COLUMN next_action_at timestamptz,
  ADD COLUMN last_contact_at timestamptz,
  ADD COLUMN ganho_em timestamptz,
  ADD COLUMN perdido_em timestamptz,
  ADD COLUMN sla_due_at timestamptz;

CREATE INDEX leads_funil_etapa_idx ON public.leads(funil_id, etapa_id);
CREATE INDEX leads_next_action_idx ON public.leads(tenant_id, next_action_at) WHERE next_action_at IS NOT NULL;

CREATE TABLE public.lead_scoring_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  evento text NOT NULL,
  pontos integer NOT NULL DEFAULT 0,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_scoring_regras(tenant_id);
ALTER TABLE public.lead_scoring_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY lsr_read ON public.lead_scoring_regras FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lsr_admin ON public.lead_scoring_regras FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE TABLE public.lead_cadencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  trigger_origem text,
  trigger_etapa_id uuid REFERENCES public.lead_funil_etapas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_cadencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_read ON public.lead_cadencias FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lc_admin ON public.lead_cadencias FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lc_upd BEFORE UPDATE ON public.lead_cadencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.lead_cadencia_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cadencia_id uuid NOT NULL REFERENCES public.lead_cadencias(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  canal text NOT NULL,
  delay_horas integer NOT NULL DEFAULT 24,
  assunto text,
  template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_cadencia_steps(cadencia_id, ordem);
ALTER TABLE public.lead_cadencia_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcs_read ON public.lead_cadencia_steps FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lcs_admin ON public.lead_cadencia_steps FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE TABLE public.lead_cadencia_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadencia_id uuid NOT NULL REFERENCES public.lead_cadencias(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.lead_cadencia_steps(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_cadencia_jobs(tenant_id, scheduled_at) WHERE status = 'pendente';
ALTER TABLE public.lead_cadencia_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcj_read ON public.lead_cadencia_jobs FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lcj_admin ON public.lead_cadencia_jobs FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

-- ============== MATCH IMÓVEL ↔ LEAD ==============
CREATE TABLE public.lead_preferencias (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  finalidade text,
  tipos text[] NOT NULL DEFAULT '{}',
  bairros text[] NOT NULL DEFAULT '{}',
  cidades text[] NOT NULL DEFAULT '{}',
  preco_min numeric(14,2),
  preco_max numeric(14,2),
  quartos_min integer,
  vagas_min integer,
  area_min numeric(10,2),
  observacoes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_preferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY lp_read ON public.lead_preferencias FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lp_admin ON public.lead_preferencias FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE TABLE public.lead_imovel_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  motivo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, imovel_id)
);
CREATE INDEX ON public.lead_imovel_matches(tenant_id, lead_id, score DESC);
ALTER TABLE public.lead_imovel_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY lim_read ON public.lead_imovel_matches FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lim_admin ON public.lead_imovel_matches FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE OR REPLACE FUNCTION public.compute_lead_matches(_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  cnt integer := 0;
BEGIN
  SELECT * INTO p FROM public.lead_preferencias WHERE lead_id = _lead_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM public.lead_imovel_matches WHERE lead_id = _lead_id;

  INSERT INTO public.lead_imovel_matches (tenant_id, lead_id, imovel_id, score, motivo)
  SELECT
    p.tenant_id, _lead_id, i.id,
    (CASE WHEN p.finalidade IS NULL OR i.finalidade::text = p.finalidade THEN 25 ELSE 0 END)
    + (CASE WHEN array_length(p.tipos,1) IS NULL OR i.tipo::text = ANY(p.tipos) THEN 15 ELSE 0 END)
    + (CASE WHEN array_length(p.bairros,1) IS NULL OR i.endereco_bairro = ANY(p.bairros) THEN 15 ELSE 0 END)
    + (CASE WHEN array_length(p.cidades,1) IS NULL OR i.endereco_cidade = ANY(p.cidades) THEN 10 ELSE 0 END)
    + (CASE WHEN (p.preco_min IS NULL OR i.preco >= p.preco_min) AND (p.preco_max IS NULL OR i.preco <= p.preco_max) THEN 15 ELSE 0 END)
    + (CASE WHEN p.quartos_min IS NULL OR COALESCE(i.quartos,0) >= p.quartos_min THEN 10 ELSE 0 END)
    + (CASE WHEN p.vagas_min IS NULL OR COALESCE(i.vagas,0) >= p.vagas_min THEN 5 ELSE 0 END)
    + (CASE WHEN p.area_min IS NULL OR COALESCE(i.area_util,0) >= p.area_min THEN 5 ELSE 0 END)
    AS score,
    jsonb_build_object('finalidade', i.finalidade, 'tipo', i.tipo, 'bairro', i.endereco_bairro, 'preco', i.preco)
  FROM public.imoveis i
  WHERE i.tenant_id = p.tenant_id
    AND i.status::text = 'ativo';

  DELETE FROM public.lead_imovel_matches WHERE lead_id = _lead_id AND score < 40;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  SELECT COUNT(*) INTO cnt FROM public.lead_imovel_matches WHERE lead_id = _lead_id;
  RETURN cnt;
END;
$$;

-- ============== LOCAÇÃO ==============
CREATE TABLE public.locacao_repasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor_aluguel numeric(14,2) NOT NULL DEFAULT 0,
  taxa_admin_percentual numeric(5,2) NOT NULL DEFAULT 0,
  taxa_admin_valor numeric(14,2) NOT NULL DEFAULT 0,
  outros_descontos numeric(14,2) NOT NULL DEFAULT 0,
  valor_repasse numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  data_recebimento date,
  data_repasse date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contrato_id, mes_referencia)
);
CREATE INDEX ON public.locacao_repasses(tenant_id, mes_referencia);
ALTER TABLE public.locacao_repasses ENABLE ROW LEVEL SECURITY;
CREATE POLICY lr_read ON public.locacao_repasses FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lr_admin ON public.locacao_repasses FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lr_upd BEFORE UPDATE ON public.locacao_repasses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.locacao_vistorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  data date NOT NULL,
  responsavel text,
  observacoes text,
  fotos_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'agendada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.locacao_vistorias(contrato_id);
ALTER TABLE public.locacao_vistorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY lv_read ON public.locacao_vistorias FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lv_admin ON public.locacao_vistorias FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lv_upd BEFORE UPDATE ON public.locacao_vistorias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.locacao_garantias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor numeric(14,2),
  vencimento date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.locacao_garantias(contrato_id);
ALTER TABLE public.locacao_garantias ENABLE ROW LEVEL SECURITY;
CREATE POLICY lg_read ON public.locacao_garantias FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lg_admin ON public.locacao_garantias FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lg_upd BEFORE UPDATE ON public.locacao_garantias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.locacao_ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'aberta',
  prioridade text NOT NULL DEFAULT 'media',
  responsavel text,
  custo numeric(14,2),
  aberta_em date NOT NULL DEFAULT CURRENT_DATE,
  prevista_para date,
  concluida_em date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.locacao_ordens_servico(contrato_id, status);
ALTER TABLE public.locacao_ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY los_read ON public.locacao_ordens_servico FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY los_admin ON public.locacao_ordens_servico FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER los_upd BEFORE UPDATE ON public.locacao_ordens_servico FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.locacao_reajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  indice text NOT NULL DEFAULT 'IGPM',
  periodicidade_meses integer NOT NULL DEFAULT 12,
  ultimo_reajuste date,
  proximo_reajuste date,
  ultimo_valor numeric(14,2),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.locacao_reajustes(tenant_id, proximo_reajuste);
ALTER TABLE public.locacao_reajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lre_read ON public.locacao_reajustes FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY lre_admin ON public.locacao_reajustes FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER lre_upd BEFORE UPDATE ON public.locacao_reajustes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== EMPREENDIMENTOS ==============
CREATE TABLE public.empreendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL,
  descricao text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  latitude double precision,
  longitude double precision,
  fase text NOT NULL DEFAULT 'lancamento',
  entrega_prevista date,
  construtora text,
  cnpj_construtora text,
  unidades_total integer,
  fotos_urls text[] NOT NULL DEFAULT '{}',
  publicado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX ON public.empreendimentos(tenant_id);
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY emp_read ON public.empreendimentos FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY emp_admin ON public.empreendimentos FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE POLICY emp_public_read ON public.empreendimentos FOR SELECT TO anon, authenticated USING (publicado = true);
CREATE TRIGGER emp_upd BEFORE UPDATE ON public.empreendimentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.empreendimento_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empreendimento_id uuid NOT NULL REFERENCES public.empreendimentos(id) ON DELETE CASCADE,
  bloco text,
  andar integer,
  numero text NOT NULL,
  tipo_planta text,
  quartos integer,
  suites integer,
  vagas integer,
  area numeric(10,2),
  preco numeric(14,2),
  status text NOT NULL DEFAULT 'disponivel',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empreendimento_id, bloco, numero)
);
CREATE INDEX ON public.empreendimento_unidades(empreendimento_id, status);
ALTER TABLE public.empreendimento_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY eu_read ON public.empreendimento_unidades FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY eu_admin ON public.empreendimento_unidades FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE POLICY eu_public_read ON public.empreendimento_unidades FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.empreendimentos e WHERE e.id = empreendimento_id AND e.publicado = true));
CREATE TRIGGER eu_upd BEFORE UPDATE ON public.empreendimento_unidades FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.empreendimento_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.empreendimento_unidades(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  corretor_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  validade timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.empreendimento_reservas(unidade_id, status);
ALTER TABLE public.empreendimento_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY er_read ON public.empreendimento_reservas FOR SELECT TO authenticated USING (is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY er_admin ON public.empreendimento_reservas FOR ALL TO authenticated USING (has_role_in_tenant(auth.uid(), tenant_id, 'admin')) WITH CHECK (has_role_in_tenant(auth.uid(), tenant_id, 'admin'));
CREATE TRIGGER er_upd BEFORE UPDATE ON public.empreendimento_reservas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
