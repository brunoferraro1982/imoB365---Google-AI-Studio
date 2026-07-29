-- Ensina o Assistente de IA sobre o diretório de construtoras, novo desde
-- 20260729020000_construtoras.sql — mesmo princípio anti-alucinação das
-- outras entradas de backend (20260725120000): conteúdo revisado
-- manualmente a partir do código real das telas, nunca gerado pelo LLM.

INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'Como funciona o diretório de construtoras e empreendimentos',
  'A imob365 mantém um diretório curado de construtoras (dados de contato, endereço, site e logo), usado no cadastro de empreendimentos e numa vitrine no rodapé do portal. O cadastro de uma construtora e a atribuição de quais imobiliárias são parceiras dela são feitos exclusivamente pela equipe da imoB365 (super_admin) — imobiliárias e corretores não cadastram nem gerenciam construtoras. No formulário de um empreendimento (em "Imobiliário" > "Empreendimentos"), a imobiliária escolhe a construtora numa lista de construtoras já cadastradas, em vez de digitar o nome livremente — qualquer imobiliária pode vincular seu empreendimento a qualquer construtora do diretório, independente de ter parceria formal atribuída ou não. Cada construtora com página pública mostra seus empreendimentos publicados e as imobiliárias marcadas como parceiras dela.',
  'backend-construtoras'
);
