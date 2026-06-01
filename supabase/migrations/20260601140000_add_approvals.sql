-- Add approval columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tipo_usuario text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plano_pretendido text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS imobiliaria_nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pagamento_validado boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pagamento_metodo text;

-- Recreate handle_new_user trigger to populate columns and assign super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (
    id, 
    nome, 
    tipo_usuario, 
    plano_pretendido, 
    imobiliaria_nome, 
    aprovado, 
    pagamento_validado, 
    pagamento_metodo
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    case when new.email = 'imob365br@gmail.com' then 'imobiliaria' else new.raw_user_meta_data->>'tipo_usuario' end,
    case when new.email = 'imob365br@gmail.com' then 'business' else new.raw_user_meta_data->>'plano_pretendido' end,
    new.raw_user_meta_data->>'imobiliaria_nome',
    case when new.email = 'imob365br@gmail.com' then true else false end,
    case when new.email = 'imob365br@gmail.com' then true else false end,
    new.raw_user_meta_data->>'pagamento_metodo'
  );

  -- Admin or Super Admin assignment
  IF new.email = 'imob365br@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (new.id, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END; $$;
