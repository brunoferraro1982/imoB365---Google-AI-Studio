-- CLM (Contract Lifecycle Management, programa de 16 sprints concluído em
-- 2026-07-28) — ensina o Assistente de IA sobre as novas telas/fluxos do
-- módulo de contratos, mesmo padrão já usado pro Financeiro/backend.
INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'Como funciona o workflow de etapas do contrato',
  'Todo contrato tem uma etapa atual, visível no topo da tela de edição do contrato (/app/contratos/$id): Captação, Análise, Documentação, Jurídico, Assinatura, Ativação, Financeiro, Administração e Encerramento, nessa ordem. O botão "Avançar" move o contrato pra próxima etapa. A transição pra "Ativação" tem regras reais que bloqueiam o avanço se não forem cumpridas: o contrato precisa ter imóvel e corretor vinculados, uma parte com o papel adequado cadastrada (vendedor para venda/permuta, locador para locação/administração), garantia ativa cadastrada quando o contrato é de locação ou administração, checklist de documentos obrigatórios completo, e assinatura eletrônica concluída por todas as partes quando o tenant tem uma integração de assinatura configurada e ativa. Quem tem permissão pra agir em cada etapa também é controlado por papel — por exemplo, o papel "financeiro" só pode agir quando o contrato está na etapa "Financeiro", sem precisar de acesso ao módulo Jurídico inteiro.',
  'backend-contratos'
),
(
  'Como funciona o checklist de documentos e a gestão documental do contrato',
  'Cada contrato tem uma seção "Checklist de documentos" (aplicável a partir de um modelo de checklist, ou item por item manualmente) e uma seção "Documentos do contrato" separada, pra anexar os arquivos de verdade (RG, CPF, CNH, comprovantes, escritura, matrícula, IPTU, laudos, procuração, recibos, etc.). O upload de documentos comprime e converte fotos automaticamente para WebP antes de enviar, com limite de 10MB por arquivo, e guarda versões anteriores quando um documento é substituído. Os documentos ficam num bucket privado — diferente das fotos de imóveis, que são públicas — só membros do tenant conseguem visualizar, e a visualização usa um link temporário de 15 minutos, nunca uma URL pública permanente. Um item de checklist pode ser vinculado ao documento correspondente. Documentos com data de validade cadastrada (ex. RG, CNH) geram um alerta automático perto do vencimento.',
  'backend-contratos'
),
(
  'Como funciona a assinatura eletrônica dos contratos',
  'A assinatura eletrônica é "traga sua própria conta" (BYO) — a imoB365 não tem uma conta mestre de assinatura compartilhada entre todos os tenants. Cada imobiliária conecta a própria conta de um provedor (DocuSign, Clicksign, ZapSign, gov.br ou ICP-Brasil) em Configurações > Assinatura eletrônica, informando a API key/token e um segredo de webhook. Depois de conectada e ativada, o painel de assinatura do contrato mostra as partes cadastradas e um botão "Solicitar assinatura" pra cada uma; a confirmação de que a parte realmente assinou chega automaticamente via webhook do provedor configurado, nunca é simulada pelo sistema. O status de assinatura do contrato como um todo (rascunho, enviado, assinado parcialmente, assinado totalmente) é calculado automaticamente a partir do status de cada parte — não é um campo editável direto.',
  'backend-contratos'
),
(
  'Como funcionam garantias e reajuste de aluguel em contratos de locação',
  'Contratos de locação e administração têm duas seções específicas na tela do contrato: "Garantias" (fiador, seguro-fiança, caução, título de capitalização, CredPago, Porto Seguro, Tokio Marine ou outro, cada uma com valor e data de vencimento) e "Reajuste do aluguel" (índice — IGPM, IPCA, INPC ou outro — e periodicidade em meses, que calculam automaticamente a data do próximo reajuste). Existe uma calculadora de reajuste dentro dessa seção: o corretor digita o percentual do índice já divulgado na fonte oficial (Banco Central, FGV etc.) e o sistema calcula o novo valor do aluguel (valor atual multiplicado por 1 mais o percentual) — essa calculadora é só uma conta aritmética simples, não busca o índice automaticamente em nenhuma fonte externa e não é inteligência artificial.',
  'backend-contratos'
),
(
  'Como funcionam os alertas automáticos de contratos e locação',
  'Além do alerta clássico de contrato próximo do vencimento, o sistema roda verificações periódicas automáticas para: garantia vencendo ou vencida, reajuste de aluguel pendente, vistoria agendada próxima ou atrasada, ordem de serviço de manutenção aberta há mais de 30 dias, documento do contrato expirando (ex. RG, CNH) e contrato marcado para renovação automática se aproximando do vencimento. Cada alerta vira uma tarefa endereçada ao corretor responsável do contrato, visível em "Minhas tarefas"; alertas de maior severidade, como documento expirado, também disparam um e-mail. Um botão "Verificar SLA agora" no Painel de Contratos permite disparar essas verificações manualmente a qualquer momento, além delas já rodarem sozinhas todo dia.',
  'backend-contratos'
),
(
  'Como o proprietário de um imóvel acompanha seu contrato',
  'Quem é cadastrado como proprietário (papel "vendedor" numa venda, ou "locador" numa locação/administração) num contrato, com o mesmo e-mail da própria conta de login da imoB365, consegue ver esse contrato em "Meus contratos" dentro da área de conta (/conta/contratos) — mostra tipo, status, valor, vigência e um link direto pro anúncio do imóvel. Esse portal do proprietário é só de leitura; qualquer alteração no contrato continua sendo feita pela imobiliária no backend. Se o proprietário não encontrar o contrato ali, o motivo mais comum é o e-mail cadastrado na parte do contrato ser diferente do e-mail da conta usada pra entrar.',
  'backend-contratos'
);
