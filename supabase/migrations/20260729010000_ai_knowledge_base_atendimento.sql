-- Central de Atendimento Sprint 10 — ensina o Assistente de IA a explicar a
-- nova Central de Atendimento (chamados), mesmo princípio anti-alucinação
-- já usado nas outras entradas de backend (20260725120000): conteúdo
-- revisado manualmente a partir do código real das telas, nunca gerado
-- pelo LLM.

INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'Como funciona a Central de Atendimento (chamados)',
  'A Central de Atendimento fica em "Central de Atendimento" > "Chamados" (/app/atendimento). É um inbox de tickets/chamados: cada chamado tem número (ex. CH-000123), assunto, categoria (problema na plataforma, dúvida comercial, reclamação sobre anúncio, financeiro/cobrança ou outro), status (novo, em atendimento, aguardando cliente, resolvido, fechado) e prioridade. Chamados chegam por vários canais: chat/formulário do site público, e-mail, WhatsApp ou criação manual (botão "Novo chamado", pra atendimento recebido por telefone ou presencial). Pra responder, selecione o chamado na lista, escreva a resposta e clique em "Enviar resposta" — ou marque "Nota interna" pra deixar uma anotação visível só pra equipe, nunca pro cliente. Admin e atendente também podem atribuir o chamado a um membro específico da equipe pelo seletor "Atribuir a".',
  'backend-atendimento'
),
(
  'Como configurar os canais de e-mail e WhatsApp da Central de Atendimento',
  'Em "Configurações" > "Canais de Atendimento" (/app/configuracoes/atendimento-canais) cada imobiliária/corretor conecta as PRÓPRIAS credenciais de e-mail (SMTP/IMAP) e WhatsApp (Evolution API) — a imob365 não centraliza nem opera esses canais em nome do tenant, cada um usa sua própria conta. Pro canal de e-mail, informe host/porta de SMTP (envio) e IMAP (recebimento), usuário, senha e o endereço de exibição. Pro WhatsApp, informe a URL da instância Evolution API, o nome da instância, a chave de API e o número — a tela mostra a URL de webhook que precisa ser cadastrada na instância. Sem configurar um canal, os chamados que chegariam por ele simplesmente não são recebidos, mas o canal Web (chat/formulário do site) e a criação manual continuam funcionando normalmente.',
  'backend-atendimento'
),
(
  'Como configurar o SLA de atendimento e ver o painel/relatórios',
  'Em "Configurações" > "SLA de Atendimento" (/app/configuracoes/atendimento-sla) o admin do tenant define o prazo de primeira resposta (em minutos) e de resolução (em horas) que a equipe se compromete a cumprir, além de ativar a distribuição automática (round robin) de chamados novos entre admin/atendente/broker. Personalizar esses prazos é um recurso dos planos Pro e Business — nos demais planos vale um padrão fixo (4h pra primeira resposta, 48h pra resolução), mas os chamados continuam sendo recebidos e respondidos normalmente. Chamados com SLA estourado geram uma tarefa de alerta pra equipe. O painel com métricas (volume, tempo médio de resposta/resolução, satisfação CSAT, breakdown por status/categoria/canal) fica em "Central de Atendimento" > "Painel" (/app/atendimento/painel), também um recurso Pro/Business. Dentro de um chamado, o botão "Sugerir resposta (IA)" (também Pro/Business) usa o Assistente de IA pra rascunhar uma resposta com base na conversa — o agente sempre revisa antes de enviar, nunca é automático.',
  'backend-atendimento'
);
