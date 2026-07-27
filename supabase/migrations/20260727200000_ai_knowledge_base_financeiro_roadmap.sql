-- Amplia a base de conhecimento do Assistente de IA (ai_knowledge_base,
-- criada em 20260724221044) com conteúdo sobre as 5 fases do roadmap do
-- módulo Financeiro implementadas em 2026-07-27 (ver changelog do
-- CLAUDE.md). Conteúdo revisado manualmente a partir do código/UI real de
-- cada tela — mesmo princípio anti-alucinação já aplicado nas duas
-- migrations anteriores de conteúdo (20260724221044/20260725120000): o
-- assistente só deve responder sobre o produto com base no que realmente
-- existe, nunca inventar passos, nomes de campos ou comportamento.

INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'Como consultar o dashboard executivo do Financeiro',
  'O dashboard executivo do Financeiro fica em "Financeiro" > "Dashboard executivo" (/app/financeiro/dashboard). Ele mostra: cartões de indicadores (Inadimplência, Pendente a vencer, Comissões pagas, Comissões a pagar), um ranking "Receita por corretor" (soma de comissões, excluindo canceladas), uma tabela "Rentabilidade por imóvel" (repasse do mês menos despesas do imóvel) e o gráfico "Fluxo de caixa projetado" com as barras de Entradas/Saídas dos próximos 6 meses (o que já está lançado como pendente/atrasado). Esse gráfico também pode mostrar duas linhas tracejadas horizontais de "média histórica" (entradas e saídas), calculadas a partir dos lançamentos já pagos nos últimos meses — é importante deixar claro que essa média é só uma conta estatística simples (soma dividida pelo número de meses com dado real), não é inteligência artificial nem previsão de verdade, e só aparece quando já existe algum lançamento marcado como pago no histórico.',
  'backend-financeiro'
),
(
  'Como funcionam os repasses de aluguel ao proprietário (locação)',
  'Os repasses de aluguel pros proprietários de imóveis alugados ficam em "Financeiro" > "Repasses (locação)" (/app/locacao/repasses). Uma rotina automática mensal gera, pra cada contrato de locação ativo, uma linha de repasse do mês (valor do aluguel menos a taxa de administração e outros descontos configurados) — não precisa criar manualmente, mas também existe um botão "Gerar agora" pra disparar na hora se precisar. Cada repasse pode ser marcado como "Recebido" (quando o aluguel entra pra imobiliária) e depois "Repassado" (quando o valor líquido é de fato transferido pro proprietário) direto na listagem.',
  'backend-financeiro'
),
(
  'Como consultar a prestação de contas de um imóvel alugado',
  'A prestação de contas consolidada de um imóvel em locação fica em "Financeiro" > "Prestação de contas" (/app/locacao/prestacao-contas). Selecione o imóvel e o mês desejado pra ver o resumo: aluguel recebido, taxa de administração, despesas do imóvel rateadas no período (manutenção etc.) e o repasse líquido final ao proprietário — é o relatório pra apresentar ou enviar ao dono do imóvel mostrando de onde veio cada valor.',
  'backend-financeiro'
),
(
  'Como funciona o cronograma de pagamento de uma venda (sinal, entrada, parcelas)',
  'Contratos de venda (tipo "Venda" em "Jurídico" > "Contratos") têm uma seção "Cronograma de pagamento" na própria página de edição do contrato. Ao preencher sinal, entrada e número de parcelas e ativar o contrato, o cronograma é gerado automaticamente: sinal e entrada vencem no início do contrato, e o restante do valor é dividido em parcelas mensais iguais. Também dá pra adicionar uma parcela avulsa manualmente (por exemplo pra uma quitação). Cada parcela mostra o tipo (sinal/entrada/parcela/quitação), o valor, o vencimento e o status (pendente/pago/atrasado/cancelado) — o botão "Marcar pago" registra o pagamento e cria automaticamente o lançamento correspondente no financeiro geral, sem precisar lançar duas vezes.',
  'backend-financeiro'
),
(
  'Como conectar e cobrar via Mercado Pago',
  'Pra receber PIX, boleto ou cartão diretamente do cliente final (comprador de um imóvel ou inquilino), primeiro conecte a conta Mercado Pago da imobiliária em "Configurações" > "Integrações Bancárias" > card "Mercado Pago" (/app/configuracoes/integracoes-bancarias/mercadopago), clicando em "Conectar Mercado Pago" — é um fluxo de autorização (OAuth) na própria página do Mercado Pago. Depois de conectado, a mesma tela mostra "Conta conectada" e libera uma opção de "Cobrança automática" (com um campo de quantos dias antes do vencimento gerar a cobrança sozinha). Uma vez conectado, aparece um botão "Cobrar via Mercado Pago" ao lado de cada parcela pendente/atrasada no cronograma de uma venda, e ao lado de lançamentos de locação vinculados a um contrato — ao clicar, gera um link de pagamento real (PIX/boleto/cartão) pro comprador ou locatário, com a comissão da plataforma descontada automaticamente. É preciso que o comprador/locatário já esteja cadastrado nas "Partes do contrato" com um e-mail preenchido, senão a cobrança não consegue ser gerada.',
  'backend-financeiro'
),
(
  'Como cadastrar conciliação bancária e integrações de ERP',
  'Em "Configurações" existem dois itens de menu separados: "Conciliação Bancária" (/app/configuracoes/conciliacao-bancaria) e "Integrações ERP" (/app/configuracoes/integracoes-erp). Cada um tem uma lista das integrações já cadastradas e um formulário direto na página (sem abrir janela) pra adicionar uma nova: escolha o banco (Banco do Brasil, Itaú, Bradesco, Santander, Nubank, Caixa ou Outro) ou o ERP (Conta Azul, Omie ou Outro), dê um nome de exibição, preencha os dados de conexão (agência/conta pro banco, Client ID/Secret pro ERP) e marque como ativa ou não. Importante: esse cadastro hoje é só administrativo — ele guarda os dados de conexão pra quando a sincronização automática de verdade for construída, mas nenhuma chamada real ao banco ou ao ERP é feita ainda.',
  'backend-financeiro'
);
