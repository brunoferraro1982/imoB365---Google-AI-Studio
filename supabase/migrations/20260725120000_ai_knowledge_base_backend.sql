-- Amplia a base de conhecimento do Assistente de IA (ai_knowledge_base,
-- criada em 20260724221044) com conteúdo sobre o BACKEND da plataforma
-- (/app) — cadastro de imóveis, leads, financeiro, marketing/portais,
-- site, contratos, equipe, e-learning, relatórios. Conteúdo revisado
-- manualmente a partir do código real das telas (labels, seções e fluxo
-- de cada formulário), não gerado pelo LLM — mesmo princípio anti-
-- alucinação já aplicado ao conteúdo público em 20260724221044: o
-- assistente só deve responder sobre o produto com base no que
-- realmente existe na tela, nunca inventar passos ou nomes de campos.

INSERT INTO public.ai_knowledge_base (titulo, conteudo, categoria) VALUES
(
  'Como cadastrar um imóvel',
  'Para cadastrar um imóvel, acesse o menu "Imobiliário" > "Imóveis" e clique em "Novo imóvel" (ou vá direto em /app/imoveis/novo). A página abre com a seção "Fotos do imóvel" no topo, mas ela só libera o upload depois que o imóvel for salvo pelo menos uma vez — até lá aparece a mensagem "Preencha os dados e salve o imóvel para adicionar fotos". Preencha o formulário logo abaixo, dividido nas seções: Informações principais, Valores e medidas, Endereço, Condições, Corretor responsável, Campos personalizados e Situação do imóvel. Clique em "Criar imóvel" para salvar — a partir daí a seção de fotos libera o botão "Adicionar fotos" (aceita múltiplos arquivos de uma vez, a primeira foto enviada vira a capa automaticamente). Para editar depois, é só abrir o imóvel na listagem e salvar de novo (o botão passa a se chamar "Salvar alterações"). Também existe "Importar imóveis" (menu Imobiliário > Importar imóveis) para cadastro em lote.',
  'backend-imoveis'
),
(
  'Como funciona o funil de leads (Kanban)',
  'A gestão de clientes e oportunidades fica em "Imobiliário" > "Clientes & oportunidades" (/app/leads), num quadro Kanban com as colunas: Novos, Em contato, Visita, Proposta, Ganho e Perdido. Cada lead é um card que pode ser arrastado entre as colunas conforme avança na negociação. Um lead pode estar vinculado a um imóvel e a um corretor responsável. Outras ferramentas do mesmo grupo: "Análise de Risco" (consulta de CPF e score pra apresentar ao proprietário), "Captação Automática" (robô que cria leads automaticamente a partir de anúncios de terceiros, disponível nos planos Pro e Business), "Minhas tarefas" e "Agenda de visitas".',
  'backend-leads'
),
(
  'Como lançar uma comissão',
  'Comissões ficam em "Financeiro" > "Comissões" (/app/comissoes). Para criar uma nova, clique em "Nova comissão" — o formulário exige vincular um contrato e um corretor reais (selecionados de listas de verdade, não é possível criar uma comissão solta sem contrato). A seção "Valores e status" define o valor da comissão e o status do pagamento. Comissões já criadas podem ser editadas, apagadas, marcadas como pagas ou canceladas direto na listagem. Cada contrato só pode ter uma comissão vinculada (não é permitido duplicar).',
  'backend-financeiro'
),
(
  'Como lançar contas a pagar e receber',
  'O financeiro geral (contas a pagar e receber, diferente de comissões) fica em "Financeiro" > "Contas a pagar e receber" (/app/financeiro). Clique em "Novo lançamento" pra registrar uma entrada ou saída. A plataforma também tem "Plano de contas" e "Centros de custo" (nos submenus de Financeiro) pra organizar e categorizar os lançamentos. Esse módulo é restrito a quem tem papel admin ou financeiro no tenant — um corretor comum não enxerga essa área.',
  'backend-financeiro'
),
(
  'Como anunciar imóveis nos portais (VivaReal, ZAP, OLX e outros)',
  'A distribuição pros portais externos fica em "Marketing" > "Anúncios em portais" (/app/portais). A plataforma gera um feed XML automático por portal — não é um botão de "publicar", é uma URL de feed que você copia (botão de copiar ao lado de cada portal) e cadastra no painel de anunciante do próprio portal (VivaReal, ZAP Imóveis, Wimóveis, Chaves na Mão, Imovelweb, Mercado Livre Imóveis e OLX Imóveis). Uma vez cadastrada a URL do lado de lá, o portal passa a ler os imóveis publicados automaticamente, sem precisar reenviar nada manualmente a cada novo imóvel. Cada portal pode ser ativado/desativado individualmente na tela. A outra parte de Marketing é "Parcerias" (/app/parcerias).',
  'backend-marketing'
),
(
  'Como configurar o site da imobiliária (white-label)',
  'Cada imobiliária tem seu próprio site público (branding próprio) configurável em "Site" no menu lateral. O caminho mais rápido é o assistente guiado em "Site" > "Site da imobiliária" (/app/site/assistente), um wizard de 10 etapas: Boas-vindas, Estilo do site, Logo, Cores, Título, Sobre você, Contato, Páginas, Seções e SEO avançado. Também dá pra editar módulo a módulo depois: "Widgets de Conteúdo" (blocos customizáveis da página), "Blog & Artigos" (posts do blog do site) e "Gerador de QR Code". Antes de publicar, use "Prévia do Site" pra ver como está ficando.',
  'backend-marketing'
),
(
  'Como criar um contrato',
  'Contratos ficam no menu "Jurídico". Pra criar um novo, vá em "Contratos" > "Novo contrato" (/app/contratos/novo). A plataforma tem uma biblioteca de modelos prontos ("Modelos de contrato" e "Biblioteca de modelos") que servem de base — depois de gerado, o contrato pode ser assinado digitalmente. "Painel" mostra a visão consolidada de todos os contratos, e "Cartórios" reúne informações de registro.',
  'backend-juridico'
),
(
  'Como convidar um corretor ou membro da equipe',
  'Em "Configurações" > "Equipe" (/app/configuracoes/equipe) dá pra convidar novas pessoas pro time: preencha o e-mail da pessoa e escolha o papel dela (broker/corretor, admin, financeiro, marketing, jurídico ou atendente), opcionalmente com CRECI e telefone. O convite é enviado por e-mail. Cada plano tem uma cota máxima de usuários — se a conta já atingiu o limite, a tela mostra "Cota do plano atingida" com um link direto pra "Plano & Contratação" fazer upgrade.',
  'backend-configuracoes'
),
(
  'Onde encontrar relatórios e indicadores',
  'Os indicadores da imobiliária ficam em "Dashboard" > "Relatórios" (/app/relatorios): funil de conversão de leads, ranking de corretores, indicadores financeiros e outros KPIs consolidados. O "Painel inicial" (/app) já traz um resumo rápido ao entrar no sistema.',
  'backend-relatorios'
),
(
  'Como funciona o E-Learning para corretores',
  'A plataforma tem um módulo de treinamento em "E-Learning": "Meus cursos" é onde qualquer corretor acessa os cursos disponíveis e acompanha seu progresso; "Gerenciar cursos" é a área do administrador/imobiliária pra criar e editar cursos, módulos e certificações — só aparece pra quem tem permissão de gestão.',
  'backend-elearning'
),
(
  'Visão geral dos módulos do backend (menu lateral)',
  'O backend da imob365 (/app) é organizado por grupos no menu lateral: Dashboard (painel inicial e relatórios), Imobiliário (imóveis, empreendimentos, locação, leads, tarefas, visitas), E-Learning (cursos), Jurídico (contratos e modelos), Financeiro (contas, comissões, plano de contas), Site (site da imobiliária, blog, widgets), Marketing (portais externos, parcerias) e Configurações (equipe, funis, lead scoring, cadências, campos personalizados, webhooks, API, segurança, privacidade/LGPD). O que cada usuário enxerga depende do plano contratado pela imobiliária, dos módulos habilitados nesse plano e do papel (função) da pessoa dentro do time — por isso é normal duas contas do mesmo tenant verem menus diferentes.',
  'backend-geral'
);
