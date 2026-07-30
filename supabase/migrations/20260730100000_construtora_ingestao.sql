-- Ingestão automatizada de empreendimentos/imóveis a partir de fontes
-- externas de uma construtora parceira (caso real: GMV divulga
-- lançamentos e revendas via Linktree, cujos links apontam pra pastas do
-- Google Drive com fotos/plantas/vídeos e tabelas de preço em PDF).
--
-- Construído de forma genérica por construtora (não hardcoded pra GMV) —
-- mesma filosofia de Construtoras V1 (20260729020000): schema pronto pra
-- qualquer construtora parceira futura usar o mesmo mecanismo, GMV é só o
-- primeiro caso de uso real. Espelha a arquitetura já usada em
-- captacao_configs/captacao_listings (20260724192104): config com
-- watermark de execução (intervalo_horas/ultima_execucao), dedupe por
-- UNIQUE, cron + botão manual de sincronização.
--
-- Decisão-chave: dado extraído por IA (preços/unidades de PDF, seleção de
-- fotos) NUNCA publica sozinho — cai sempre num "lote" pendente de
-- revisão do super_admin (mesma decisão de escopo de Construtoras V1: só
-- o super_admin cadastra/gerencia dado de construtora parceira nesta
-- fase). A aprovação de um lote cria/atualiza um `empreendimentos`
-- (ou `imoveis`) de verdade, sempre com publicado=false — quem decide
-- publicar é o fluxo normal já existente em /app/empreendimentos ou
-- /app/imoveis.

CREATE TABLE public.construtora_fontes_ingestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construtora_id uuid NOT NULL REFERENCES public.construtoras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  tipo_alvo text NOT NULL CHECK (tipo_alvo IN ('empreendimento', 'imovel')),
  ativo boolean NOT NULL DEFAULT true,
  intervalo_horas integer NOT NULL DEFAULT 24,
  ultima_execucao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.construtora_fontes_ingestao(construtora_id);
CREATE INDEX ON public.construtora_fontes_ingestao(ativo, ultima_execucao);

CREATE TRIGGER construtora_fontes_ingestao_upd BEFORE UPDATE ON public.construtora_fontes_ingestao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Um "lote" = um lançamento ou um imóvel de revenda descoberto numa fonte
-- (ex.: "Residencial The One" descoberto em gmvpredios2).
CREATE TABLE public.construtora_ingestao_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id uuid NOT NULL REFERENCES public.construtora_fontes_ingestao(id) ON DELETE CASCADE,
  construtora_id uuid NOT NULL REFERENCES public.construtoras(id) ON DELETE CASCADE,
  nome_bruto text NOT NULL,
  link_origem text NOT NULL,
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'coletando', 'pronto_revisao', 'aprovado', 'rejeitado', 'erro')),
  dados_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_mensagem text,
  empreendimento_id uuid REFERENCES public.empreendimentos(id) ON DELETE SET NULL,
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE SET NULL,
  revisado_por uuid,
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fonte_id, nome_bruto)
);

CREATE INDEX ON public.construtora_ingestao_lotes(construtora_id);
CREATE INDEX ON public.construtora_ingestao_lotes(status);

CREATE TRIGGER construtora_ingestao_lotes_upd BEFORE UPDATE ON public.construtora_ingestao_lotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Cada mídia candidata (foto/planta/vídeo/pdf) descoberta pra um lote.
-- thumbnail_url é o thumbnailLink que a própria Drive API já devolve —
-- usado na pontuação por IA sem precisar baixar o arquivo original de
-- cada candidata; storage_path só é preenchido quando a mídia é
-- efetivamente aprovada e copiada pro bucket público imovel-fotos.
CREATE TABLE public.construtora_ingestao_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.construtora_ingestao_lotes(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('foto_fachada', 'foto_lazer', 'foto_planta', 'video', 'pdf_tabela', 'outro')),
  origem_drive_id text,
  thumbnail_url text,
  score_ia numeric(5, 2),
  legenda_ia text,
  recomendada boolean NOT NULL DEFAULT false,
  aprovada boolean NOT NULL DEFAULT false,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.construtora_ingestao_midias(lote_id);

ALTER TABLE public.construtora_fontes_ingestao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construtora_ingestao_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construtora_ingestao_midias ENABLE ROW LEVEL SECURITY;

-- Mesma decisão de escopo de Construtoras V1: só super_admin cadastra
-- fontes e revisa/aprova lotes desta fase — imobiliária/corretor não
-- gerenciam nada disso (só passam a ver o empreendimento/imóvel
-- resultante já dentro do fluxo normal, depois de aprovado).
CREATE POLICY ingestao_super_admin_all_fontes ON public.construtora_fontes_ingestao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ingestao_super_admin_all_lotes ON public.construtora_ingestao_lotes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ingestao_super_admin_all_midias ON public.construtora_ingestao_midias FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- GRANT explícito nas 3 roles já na própria migration — lição operacional
-- documentada no CLAUDE.md: tabela aplicada via psql direto por SSH nunca
-- herda o GRANT automático que este self-host dá por padrão via
-- Studio/CLI (achado real em captacao_configs e em 4 tabelas do CLM,
-- ambos em 2026-07-2x).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtora_fontes_ingestao TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtora_ingestao_lotes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtora_ingestao_midias TO anon, authenticated, service_role;

-- Storage: bucket privado pra mídia bruta pré-revisão (diferente de
-- construtora-logos, que já nasce público — aqui o conteúdo só devia
-- ficar visível depois de aprovado, quando já foi copiado pro
-- imovel-fotos). Só super_admin lê/escreve, mesmo escopo das tabelas
-- acima. Bucket + todas as policies já na mesma migration, evitando o bug
-- recorrente já documentado (bucket que nasce só com policy de leitura).
INSERT INTO storage.buckets (id, name, public)
VALUES ('construtora-ingestao', 'construtora-ingestao', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "construtora-ingestao super_admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'construtora-ingestao' AND has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (bucket_id = 'construtora-ingestao' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Auditoria — mesmo padrão já usado nas demais tabelas novas do projeto.
CREATE TRIGGER tg_audit_construtora_fontes_ingestao AFTER INSERT OR UPDATE OR DELETE ON public.construtora_fontes_ingestao
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE TRIGGER tg_audit_construtora_ingestao_lotes AFTER INSERT OR UPDATE OR DELETE ON public.construtora_ingestao_lotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
