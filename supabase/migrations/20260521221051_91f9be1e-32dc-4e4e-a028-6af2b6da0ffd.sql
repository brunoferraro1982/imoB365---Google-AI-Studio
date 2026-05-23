
-- Função utilitária (cria se não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Buscas salvas por usuário (com alertas opcionais por e-mail)
CREATE TABLE public.buscas_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerta_email boolean NOT NULL DEFAULT false,
  ultimo_envio timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_buscas_salvas_user ON public.buscas_salvas(user_id);

ALTER TABLE public.buscas_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved searches"
ON public.buscas_salvas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved searches"
ON public.buscas_salvas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches"
ON public.buscas_salvas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches"
ON public.buscas_salvas FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_buscas_salvas_updated
BEFORE UPDATE ON public.buscas_salvas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Favoritos
CREATE TABLE public.favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  imovel_id uuid NOT NULL,
  pasta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, imovel_id)
);

CREATE INDEX idx_favoritos_user ON public.favoritos(user_id);
CREATE INDEX idx_favoritos_imovel ON public.favoritos(imovel_id);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
ON public.favoritos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
ON public.favoritos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
ON public.favoritos FOR DELETE
USING (auth.uid() = user_id);
