-- Estado da sincronização semanal de materiais de construtoras (Econ,
-- Coralon) — snapshot das pastas públicas do Drive/site e último relatório.
-- Só o servidor (service role) lê/escreve: RLS ligada e nenhuma policy.
create table if not exists public.fornecedor_sync (
  fonte text primary key,
  snapshot jsonb not null default '{}'::jsonb,
  relatorio jsonb,
  executado_em timestamptz not null default now()
);
alter table public.fornecedor_sync enable row level security;
