-- Fix: favoritos.imovel_id não tinha FK — PostgREST não resolvia o embed
-- imoveis:imovel_id(...) usado em listarFavoritos() (mesma causa já corrigida em visitas)

ALTER TABLE public.favoritos
  ADD CONSTRAINT favoritos_imovel_id_fkey
  FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;
