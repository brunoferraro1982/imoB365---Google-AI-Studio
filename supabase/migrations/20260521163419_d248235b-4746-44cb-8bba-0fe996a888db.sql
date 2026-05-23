
-- Cartórios: tabela de registros junto a cartórios (e-Notariado, ONR)
CREATE TABLE IF NOT EXISTS public.cartorio_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('escritura','registro','averbacao','procuracao','outro')),
  protocolo text,
  cartorio_nome text,
  cidade text,
  uf text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','protocolado','em_exigencia','registrado','cancelado')),
  data_protocolo date,
  data_registro date,
  custas numeric(12,2),
  observacoes text,
  arquivo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cartorio_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_cartorio" ON public.cartorio_registros FOR SELECT
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY "tenant_insert_cartorio" ON public.cartorio_registros FOR INSERT
  WITH CHECK (public.is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY "tenant_update_cartorio" ON public.cartorio_registros FOR UPDATE
  USING (public.is_member_of_tenant(auth.uid(), tenant_id));
CREATE POLICY "tenant_delete_cartorio" ON public.cartorio_registros FOR DELETE
  USING (public.has_role_in_tenant(auth.uid(), tenant_id, 'admin'));

CREATE TRIGGER tg_cartorio_updated_at BEFORE UPDATE ON public.cartorio_registros
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_cartorio_audit AFTER INSERT OR UPDATE OR DELETE ON public.cartorio_registros
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE INDEX idx_cartorio_tenant ON public.cartorio_registros(tenant_id);
CREATE INDEX idx_cartorio_contrato ON public.cartorio_registros(contrato_id);
