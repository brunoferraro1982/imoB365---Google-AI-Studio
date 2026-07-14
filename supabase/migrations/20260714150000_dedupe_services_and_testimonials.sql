-- As tabelas services e testimonials têm cada linha duplicada (mesmo titulo/ordem,
-- id diferente, mesmíssimo created_at) — indica que o seed original rodou duas vezes.
-- Causa a duplicação visível em /a-imob365#servicos e na seção de depoimentos.
-- Mantém 1 linha por (tenant_id, titulo, ordem) / (tenant_id, nome, ordem), removendo
-- as demais. Funciona independente de quantas duplicatas existirem por grupo.

delete from public.services a
using public.services b
where a.tenant_id = b.tenant_id
  and a.titulo = b.titulo
  and a.ordem = b.ordem
  and a.id > b.id;

delete from public.testimonials a
using public.testimonials b
where a.tenant_id = b.tenant_id
  and a.nome = b.nome
  and a.ordem = b.ordem
  and a.id > b.id;
