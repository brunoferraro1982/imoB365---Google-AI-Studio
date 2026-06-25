-- Fix: visitas não tinha FKs — PostgREST não resolvia os joins
-- imovel:imoveis(id,titulo), corretor:corretores(id,nome), lead:leads(id,nome)

ALTER TABLE public.visitas
  ADD CONSTRAINT visitas_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.visitas
  ADD CONSTRAINT visitas_imovel_id_fkey
  FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;

ALTER TABLE public.visitas
  ADD CONSTRAINT visitas_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.visitas
  ADD CONSTRAINT visitas_corretor_id_fkey
  FOREIGN KEY (corretor_id) REFERENCES public.corretores(id) ON DELETE SET NULL;
