-- ============================================================
-- Migration: URLs financeiras movidas para /app/financeiro/
-- Registra os aliases para auditoria e eventual middleware
-- ============================================================

-- Tabela de aliases de rota (para log/auditoria de redirects)
CREATE TABLE IF NOT EXISTS route_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path   TEXT NOT NULL UNIQUE,
  to_path     TEXT NOT NULL,
  status_code SMALLINT NOT NULL DEFAULT 301,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE route_aliases ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode gerenciar aliases
CREATE POLICY "super_admin_manages_route_aliases"
  ON route_aliases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- Policy de leitura para qualquer autenticado (para Cloudflare Worker consultar)
CREATE POLICY "authenticated_reads_route_aliases"
  ON route_aliases
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed: registrar os redirects dos itens financeiros
INSERT INTO route_aliases (from_path, to_path, status_code) VALUES
  ('/app/configuracoes/plano-contas',  '/app/financeiro/plano-contas',  301),
  ('/app/configuracoes/centros-custo', '/app/financeiro/centros-custo', 301)
ON CONFLICT (from_path) DO UPDATE
  SET to_path = EXCLUDED.to_path,
      active  = true;

-- Comentário de contexto
COMMENT ON TABLE route_aliases IS
  'Tabela de aliases de rota para redirects 301 gerenciados via Cloudflare Worker ou middleware Next.js/Vite.';

