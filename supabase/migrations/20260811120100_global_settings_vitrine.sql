-- global_settings (key/value Json) já existe no schema mas não era usada. Vai
-- guardar a velocidade do marquee da Vitrine de Parceiros na chave
-- 'vitrine_marquee'. Leitura pública é restrita A ESSA CHAVE (não expõe outras
-- chaves que a tabela venha a ter); escrita só super_admin.

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "global_settings_public_read_vitrine" ON public.global_settings;
CREATE POLICY "global_settings_public_read_vitrine" ON public.global_settings
  FOR SELECT USING (key = 'vitrine_marquee');

DROP POLICY IF EXISTS "global_settings_super_admin_insert" ON public.global_settings;
CREATE POLICY "global_settings_super_admin_insert" ON public.global_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "global_settings_super_admin_update" ON public.global_settings;
CREATE POLICY "global_settings_super_admin_update" ON public.global_settings
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE ON public.global_settings TO anon, authenticated, service_role;

-- Seed da velocidade (Média = 28s, igual ao valor fixo atual do CSS).
INSERT INTO public.global_settings (key, value)
VALUES ('vitrine_marquee', '{"speedSeconds": 28}'::jsonb)
ON CONFLICT (key) DO NOTHING;
