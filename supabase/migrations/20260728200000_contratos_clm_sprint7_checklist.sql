-- CLM Sprint 7 — Checklist: adapta o sistema já existente (checklist_templates/
-- checklist_template_itens/contrato_checklist, funcional desde 2026-05-21) em
-- vez de recriar. Duas mudanças: (1) liga o item do checklist a um arquivo real
-- quando existir (documento_id, sem FK ainda — contrato_documentos só nasce no
-- Sprint 8; a constraint é adicionada naquela migration via ADD CONSTRAINT
-- quando a tabela existir); (2) fecha o mesmo gap de RLS super_admin já
-- encontrado e corrigido em locacao_reajustes (Sprint 4) e locacao_garantias
-- (Sprint 5) — contrato_checklist também só tinha policies de membro do
-- tenant, sem bypass de super_admin.
ALTER TABLE public.contrato_checklist
  ADD COLUMN IF NOT EXISTS documento_id uuid;

DROP POLICY IF EXISTS cc_super_admin_all ON public.contrato_checklist;
CREATE POLICY cc_super_admin_all ON public.contrato_checklist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
