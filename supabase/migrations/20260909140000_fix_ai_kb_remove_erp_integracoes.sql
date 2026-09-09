-- Atualiza a entrada da base de conhecimento do Assistente de IA sobre
-- "Conciliação bancária e integrações de ERP" (seed original em
-- 20260727200000) — a metade de "Integrações ERP" (Conta Azul/Omie) foi
-- removida do produto (investigação estratégica: essas plataformas
-- competem diretamente com o próprio Financeiro do imob365 — contas a
-- pagar/receber, fluxo de caixa, DRE, centros de custo, cobrança via
-- PIX/boleto/cartão já são nativos aqui). Sem isso, o assistente
-- continuaria respondendo sobre uma tela que não existe mais.
UPDATE public.ai_knowledge_base
SET
  titulo = 'Como cadastrar conciliação bancária',
  conteudo = 'Em "Configurações" existe o item "Conciliação Bancária" (/app/configuracoes/conciliacao-bancaria) — uma lista das contas bancárias já cadastradas e um formulário direto na página (sem abrir janela) pra adicionar uma nova: escolha o banco (Banco do Brasil, Itaú, Bradesco, Santander, Nubank, Caixa ou Outro), dê um nome de exibição, preencha agência/conta e marque como ativa ou não. Importante: esse cadastro hoje é só administrativo — ele guarda os dados de conexão pra quando a sincronização automática de verdade for construída (depende de um agregador de Open Finance certificado, como Pluggy), mas nenhuma chamada real ao banco é feita ainda. Não existe mais integração com ERPs de terceiros (Conta Azul, Omie) — o próprio Financeiro do imob365 já cobre contas a pagar/receber, fluxo de caixa, DRE e centros de custo nativamente.'
WHERE titulo = 'Como cadastrar conciliação bancária e integrações de ERP';
