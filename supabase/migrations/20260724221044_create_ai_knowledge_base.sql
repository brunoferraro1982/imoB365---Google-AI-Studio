-- Base de conhecimento pro assistente de IA (RAG) — conteúdo curado sobre
-- mercado imobiliário brasileiro, usado como contexto real injetado no
-- prompt do Llama antes de responder. Sem isso, o modelo alucina fatos
-- básicos (testado manualmente: "ITBI = Imposto sobre Transmissão
-- Bucólica", inventado) — a base aqui é a única fonte de verdade factual
-- que o assistente deve usar pra perguntas de domínio.
--
-- Busca por full-text search nativo do Postgres (tsvector/GIN), sem
-- extensão nova — suficiente pro tamanho do corpus e evita rodar um
-- segundo modelo (embeddings) na mesma CPU já limitada da VPS (sem GPU).

CREATE TABLE public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  busca tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', titulo || ' ' || conteudo)
  ) STORED
);

CREATE INDEX idx_ai_knowledge_base_busca ON public.ai_knowledge_base USING GIN (busca);
CREATE INDEX idx_ai_knowledge_base_ativo ON public.ai_knowledge_base (ativo);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_base_public_read" ON public.ai_knowledge_base
  FOR SELECT TO anon, authenticated
  USING (ativo = true);

CREATE POLICY "ai_knowledge_base_super_admin_all" ON public.ai_knowledge_base
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- GRANT explícito, sempre — lição do incidente de produção de hoje
-- (captacao_configs/captacao_listings ficaram sem grant básico por terem
-- sido criadas via psql -U supabase_admin em vez do fluxo normal via
-- Studio/CLI, que roda como o role `postgres`; o ALTER DEFAULT PRIVILEGES
-- desta instância self-hosted só cobre objetos criados por `postgres`).
GRANT SELECT ON public.ai_knowledge_base TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_knowledge_base TO authenticated;

-- Seed curado — conteúdo factual, revisado manualmente (não gerado pelo
-- próprio LLM, exatamente pra evitar propagar as alucinações observadas
-- no teste). Valores de alíquota/percentual deliberadamente evitados ou
-- apresentados como "consulte", já que variam por município/instituição
-- e mudam com o tempo — melhor recomendar verificação do que arriscar um
-- número desatualizado ou inventado.
INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'O que é o ITBI',
  'ITBI significa Imposto de Transmissão de Bens Imóveis. É um imposto municipal (não estadual e não federal) cobrado sempre que um imóvel muda de dono por venda ou outra forma de transmissão onerosa. Quem paga é o comprador, e o valor é calculado como um percentual sobre o valor do imóvel (o percentual exato varia de prefeitura para prefeitura — é essencial consultar a prefeitura da cidade onde fica o imóvel para saber a alíquota vigente). O ITBI costuma ser pago antes do registro da escritura em cartório, e sem esse pagamento o registro não é concluído.',
  'itbi'
),
(
  'Sistema de Amortização Constante (SAC) no financiamento imobiliário',
  'SAC (Sistema de Amortização Constante) é o modelo de financiamento imobiliário mais comum no Brasil. Nele, o valor da amortização (a parte da parcela que reduz a dívida) é sempre o mesmo, mas os juros incidem sobre o saldo devedor, que vai diminuindo mês a mês — por isso as parcelas do SAC começam mais altas e vão ficando menores ao longo do financiamento. É diferente do sistema Price, onde a parcela é fixa do início ao fim. Bancos e a Caixa Econômica Federal costumam oferecer SAC como padrão para financiamento habitacional.',
  'financiamento'
),
(
  'Documentos comuns para financiar um imóvel',
  'Para solicitar financiamento imobiliário no Brasil, os documentos tipicamente exigidos incluem: documento de identidade e CPF, comprovante de renda (holerites, declaração de Imposto de Renda ou extratos bancários para autônomos), comprovante de residência, certidão de estado civil, e, se for usar o FGTS como parte do pagamento, extrato do FGTS. A lista exata varia por instituição financeira — sempre confirme diretamente com o banco escolhido antes de dar entrada no processo.',
  'financiamento'
),
(
  'Custos de uma mudança residencial',
  'Além do valor do imóvel em si, uma mudança residencial envolve custos que costumam ser subestimados: frete de mudança (varia por distância e volume), embalagens e materiais de proteção, eventual armazenamento temporário, taxas de condomínio proporcionais, religação de serviços (água, luz, gás, internet), e possíveis reformas ou adaptações no novo imóvel. Planejar esses custos com antecedência evita surpresas no orçamento da mudança.',
  'mudanca'
),
(
  'Sobre a imoB365',
  'A imoB365 é uma plataforma que conecta imobiliárias, corretores e clientes em todo o Brasil, unindo tecnologia e atendimento humano para tornar a compra, venda e locação de imóveis mais simples. A plataforma oferece um portal público de busca de imóveis, ferramentas de gestão para corretores e imobiliárias parceiras (CRM, captação de leads, contratos, financeiro), e calculadoras públicas de financiamento, ITBI e custos de mudança para ajudar quem está pesquisando um imóvel a se planejar melhor.',
  'institucional'
);
