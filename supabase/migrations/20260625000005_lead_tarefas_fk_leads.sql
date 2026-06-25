-- Fix: lead_tarefas.lead_id não tem FK para leads
-- Supabase PostgREST precisa da FK para resolver o join "lead:leads(id,nome)"

ALTER TABLE public.lead_tarefas
  ADD CONSTRAINT lead_tarefas_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
