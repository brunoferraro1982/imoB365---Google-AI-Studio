
-- 1. Leads: UTM + dedupe hashes
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS ip_origem text,
  ADD COLUMN IF NOT EXISTS telefone_hash text,
  ADD COLUMN IF NOT EXISTS email_hash text;

CREATE INDEX IF NOT EXISTS idx_leads_telefone_hash ON public.leads(tenant_id, telefone_hash) WHERE telefone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email_hash ON public.leads(tenant_id, email_hash) WHERE email_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.leads_set_dedupe_hashes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_hash := encode(digest(regexp_replace(NEW.telefone, '\D', '', 'g'), 'sha256'), 'hex');
  ELSE
    NEW.telefone_hash := NULL;
  END IF;
  IF NEW.email IS NOT NULL THEN
    NEW.email_hash := encode(digest(lower(trim(NEW.email)), 'sha256'), 'hex');
  ELSE
    NEW.email_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_dedupe_hashes ON public.leads;
CREATE TRIGGER trg_leads_dedupe_hashes
BEFORE INSERT OR UPDATE OF telefone, email ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_set_dedupe_hashes();

-- Backfill hashes existentes
UPDATE public.leads SET telefone = telefone WHERE telefone_hash IS NULL AND telefone IS NOT NULL;
UPDATE public.leads SET email = email WHERE email_hash IS NULL AND email IS NOT NULL;

-- 2. Imóvel: histórico de alterações
CREATE TABLE IF NOT EXISTS public.imovel_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imovel_historico_imovel ON public.imovel_historico(imovel_id, created_at DESC);
ALTER TABLE public.imovel_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read historico"
ON public.imovel_historico FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id = imovel_historico.tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE OR REPLACE FUNCTION public.imoveis_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.preco IS DISTINCT FROM OLD.preco THEN
    INSERT INTO public.imovel_historico (tenant_id, imovel_id, campo, valor_anterior, valor_novo, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'preco', OLD.preco::text, NEW.preco::text, auth.uid());
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.imovel_historico (tenant_id, imovel_id, campo, valor_anterior, valor_novo, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  IF NEW.publicado IS DISTINCT FROM OLD.publicado THEN
    INSERT INTO public.imovel_historico (tenant_id, imovel_id, campo, valor_anterior, valor_novo, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'publicado', OLD.publicado::text, NEW.publicado::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imoveis_log_changes ON public.imoveis;
CREATE TRIGGER trg_imoveis_log_changes
AFTER UPDATE ON public.imoveis
FOR EACH ROW EXECUTE FUNCTION public.imoveis_log_changes();

-- 3. Encurtador de URL
CREATE TABLE IF NOT EXISTS public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  target_url text NOT NULL,
  label text,
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  clicks_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug)
);
CREATE INDEX IF NOT EXISTS idx_short_links_tenant ON public.short_links(tenant_id, created_at DESC);
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members manage short_links"
ON public.short_links FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id = short_links.tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id = short_links.tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TABLE IF NOT EXISTS public.short_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id uuid NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_link ON public.short_link_clicks(short_link_id, created_at DESC);
ALTER TABLE public.short_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read clicks"
ON public.short_link_clicks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.short_links sl
    JOIN public.profiles p ON p.tenant_id = sl.tenant_id
    WHERE sl.id = short_link_clicks.short_link_id AND p.id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 4. Feature flags por tenant
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, flag_key)
);
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read flags"
ON public.tenant_feature_flags FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id = tenant_feature_flags.tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "super_admin manage flags"
ON public.tenant_feature_flags FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Limites por plano
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value integer NOT NULL,
  PRIMARY KEY (plan_id, limit_key)
);
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read plan_limits"
ON public.plan_limits FOR SELECT
USING (true);

CREATE POLICY "super_admin manage plan_limits"
ON public.plan_limits FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 6. Snapshots de uso por tenant (métricas SaaS)
CREATE TABLE IF NOT EXISTS public.tenant_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  imoveis_count integer NOT NULL DEFAULT 0,
  usuarios_count integer NOT NULL DEFAULT 0,
  leads_count integer NOT NULL DEFAULT 0,
  mensagens_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, snapshot_date)
);
ALTER TABLE public.tenant_usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admins read usage"
ON public.tenant_usage_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.tenant_id = tenant_usage_snapshots.tenant_id
  )
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "super_admin manage usage"
ON public.tenant_usage_snapshots FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Habilitar extensão pgcrypto se necessário (para digest)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
