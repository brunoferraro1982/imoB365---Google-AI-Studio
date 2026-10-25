-- Integridade de dados entre Leads / Minhas Tarefas / Agenda de Visitas /
-- Roteiro de Visitas. Mesmo padrão já repetido várias vezes neste projeto:
-- essas 4 tabelas nunca tiveram algumas de suas FKs/índices criados
-- (confirmado lendo todas as migrations anteriores) — corrigido aqui de
-- uma vez para as 4 áreas.
--
-- Colunas NOT NULL (tenant_id) não podem ser "órfão-nuladas" — se existir
-- linha real apontando pra um tenant já apagado, o ADD CONSTRAINT abaixo
-- falha de propósito (sinal de drift real que precisa de decisão manual,
-- não algo pra corrigir silenciosamente numa migration).

-- leads.tenant_id — nunca teve FK
ALTER TABLE public.leads
  ADD CONSTRAINT leads_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE CASCADE;

-- leads.imovel_id — nunca teve FK nem índice
UPDATE public.leads SET imovel_id = NULL
  WHERE imovel_id IS NOT NULL AND imovel_id NOT IN (SELECT id FROM public.imoveis);
ALTER TABLE public.leads
  ADD CONSTRAINT leads_imovel_id_fkey FOREIGN KEY (imovel_id)
  REFERENCES public.imoveis(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_imovel_idx ON public.leads(imovel_id);

-- leads.corretor_id — nunca teve FK (índice já existe: leads_corretor_idx)
UPDATE public.leads SET corretor_id = NULL
  WHERE corretor_id IS NOT NULL AND corretor_id NOT IN (SELECT id FROM public.corretores);
ALTER TABLE public.leads
  ADD CONSTRAINT leads_corretor_id_fkey FOREIGN KEY (corretor_id)
  REFERENCES public.corretores(id) ON DELETE SET NULL;

-- corretores.tenant_id — nunca teve FK (índice já existe: idx_corretores_tenant)
ALTER TABLE public.corretores
  ADD CONSTRAINT corretores_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE CASCADE;

-- visitas — FKs já existem (20260625000007), só faltavam os índices
CREATE INDEX IF NOT EXISTS idx_visitas_imovel ON public.visitas(imovel_id);
CREATE INDEX IF NOT EXISTS idx_visitas_lead ON public.visitas(lead_id);
CREATE INDEX IF NOT EXISTS idx_visitas_roteiro_etapa ON public.visitas(roteiro_etapa_id);

-- roteiro_visita_etapas.tenant_id — FK já existe (20260806110000), faltava
-- o índice — usada em toda checagem de RLS desta tabela
CREATE INDEX IF NOT EXISTS idx_roteiro_visita_etapas_tenant ON public.roteiro_visita_etapas(tenant_id);

-- lead_tarefas.visita_id (nova) — vínculo persistido entre uma tarefa e a
-- visita gerada a partir dela ("Gerar visita" em /app/tarefas e no lead),
-- que hoje só existe como navegação/pré-preenchimento, sem nenhuma
-- referência de volta.
ALTER TABLE public.lead_tarefas ADD COLUMN IF NOT EXISTS visita_id uuid;
ALTER TABLE public.lead_tarefas
  ADD CONSTRAINT lead_tarefas_visita_id_fkey FOREIGN KEY (visita_id)
  REFERENCES public.visitas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lead_tarefas_visita ON public.lead_tarefas(visita_id);
