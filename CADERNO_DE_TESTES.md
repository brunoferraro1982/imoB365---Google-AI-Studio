# 📓 Caderno de Testes do Sistema — imob365

Este caderno de testes foi desenvolvido sob princípios rigorosos de Quality Assurance (QA) para orientar a validação manual (humana) das funcionalidades do portal **imob365 / Imóvel Conectado**. Ele divide-se em seções de **Frontend** e **Backend**, com critérios claros de aceitação baseados em fluxos reais, carregamento de mídias/assets e comportamentos de rotas do sistema.

### 📥 Versão em Planilha para Download
Para facilitar a marcação, compilação de resultados e compartilhamento com a equipe:
* **[Clique aqui para baixar o Caderno de Testes em formato Planilha (.CSV)](/caderno_de_testes_imob365.csv)**
> *Dica:* O arquivo está salvo no padrão brasileiro (separado por `;`). Ao abrir no Excel ou Google Sheets, os acentos e colunas serão exibidos automaticamente de forma limpa e estruturada.

Para cada cenário, marque a flag apropriada (**Sim** para aprovado, **Não** para falha/inconsistência) e registre observações se necessário.

---

## 🖥️ Seção 1: Testes de Interface e Usabilidade (Frontend)

### 1. Cabeçalho (Header), Navegação e Redirecionamentos Críticos
Assegura que os links de navegação globais e as ações rápidas performam os redirecionamentos corretos de acordo com o estado do usuário (logado vs. deslogado).

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TF-01** | **Botão "Anunciar Imóvel" (Logado)**<br>1. Faça login na conta.<br>2. Na barra de navegação superior, clique no botão principal "Anunciar Imóvel". | O usuário deve ser redirecionado **imediatamente** para a rota `/app/imoveis/novo`. | `[ ] Sim  [ ] Não` |
| **TF-02** | **Botão "Anunciar Imóvel" (Deslogado)**<br>1. Garanta que está deslogado.<br>2. Na home (`/`), clique no botão "Anunciar Imóvel". | O usuário deve ser redirecionado para a tela de registro/cadastro `/signup`. | `[ ] Sim  [ ] Não` |
| **TF-03** | **Menu de Usuário Mobile ("Anunciar meu Imóvel")**<br>1. Emulando visualização mobile, abra o menu sanduíche.<br>2. Clique em "Anunciar meu Imóvel" (ou "Anunciar Novo Imóvel" no menu de usuário). | Usuário logado vai para `/app/imoveis/novo`. Usuário deslogado é encaminhado para `/signup`. | `[ ] Sim  [ ] Não` |
| **TF-04** | **Botão "Planos e Preços" no Rodapé e Menu**<br>1. Clique no item "Planos & Valores" ou "Planos e Preços" no rodapé da página inicial. | Deve renderizar a página comercial de planos `/planos` sem quebras de layout. | `[ ] Sim  [ ] Não` |
| **TF-05** | **Logo "imoB365" (Link de Retorno)**<br>1. Clique no logo principal no cabeçalho estando em qualquer subpágina. | O sistema deve retornar à página inicial (`/`) de forma instantânea. | `[ ] Sim  [ ] Não` |

---

### 2. Carregamento de Recursos Visuais (Assets & Logos)
Valida a integridade da identidade visual do imob365 e a resiliência do sistema no carregamento das mídias.

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TF-06** | **Carregamento da Logo (Tema Escuro / Light)**<br>1. Acesse a landing page (`/`) e navegue entre o topo (fundo claro) e o rodapé (fundo escuro). | A logo `logo-imob365.png` deve aparecer perfeita no topo; e a versão `logo-imob365-white.png` visível no rodapé. | `[ ] Sim  [ ] Não` |
| **TF-07** | **Resiliência de Queda da Logo (Fallback)**<br>1. Para simular falha, adicione uma regra de bloqueio do asset de imagem no DevTools do navegador.<br>2. Recarregue a página. | O componente de logo deve interceptar a falha e renderizar uma versão textual/vetorial limpa e em alta escala (`"im" + LogoIcon + "B365"`). | `[ ] Sim  [ ] Não` |
| **TF-08** | **Ícone Favicon do Sistema**<br>1. Abra a aplicação em uma nova aba do navegador.<br>2. Olhe para a aba do browser. | Deve exibir o ícone oficial `favicon.png` de forma nítida na aba. | `[ ] Sim  [ ] Não` |
| **TF-09** | **Imagem de Background do Hero da Home**<br>1. Carregue a página inicial `/` e verifique a seção inicial de busca. | O fundo deve carregar a imagem `hero-bg.jpg` sem pixelização ou atrasos severos. | `[ ] Sim  [ ] Não` |

---

### 3. Matriz de Planos, Contratação e Limites
Foca na renderização correta das opções comerciais, com destaque para a inclusão obrigatória do plano Starter/Grátis.

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TF-10** | **Plano "Grátis" / "Starter" em Destaque Inicial**<br>1. Acesse a página `/planos` deslogado e logado. | O plano voluntário/gratuito deve ser o **primeiro a esquerda da lista**, indicando preço "Grátis" e limite de 25 imóveis e 3 usuários. | `[ ] Sim  [ ] Não` |
| **TF-11** | **Formatador de Valores Financeiros**<br>1. Analise o preço listado nos cartões de cada plano. | O preço dos planos faturados deve exibir o formato padrão em Real brasileiro, ex: `R$ 99,00`, `R$ 199,00`. | `[ ] Sim  [ ] Não` |
| **TF-12** | **Botão "Começar com [Plano]" (Deslogado)**<br>1. Na página `/planos` deslogado, clique em qualquer botão de contratação. | O sistema deve direcioná-lo para a tela `/signup` para criar uma conta do zero. | `[ ] Sim  [ ] Não` |
| **TF-13** | **Botão "Começar com [Plano]" (Logado)**<br>1. Faça login no sistema.<br>2. Retorne a `/planos` e clique no botão do plano desejado. | Deve direcionar para o fluxo interno de contratação `/app/contratacao` repassando o ID do plano selecionado. | `[ ] Sim  [ ] Não` |

---

### 4. Cadastro de Imóveis e Painel Administrativo (CRM)
Valida as principais regras operacionais das telas utilizadas no dia a dia pelos corretores.

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TF-14** | **Tela de Novo Imóvel (`/app/imoveis/novo`)**<br>1. Acesse o formulário de cadastro de novos imóveis. | Deve carregar todos os campos (tipo de imóvel, valores, área, localização) em um formulário responsivo e sem travamentos. | `[ ] Sim  [ ] Não` |
| **TF-15** | **Busca de Cidades e Geocoding Mapas**<br>1. Insira um endereço completo no cadastro de imóvel.<br>2. Verifique se o mapa carrega a marcação na localização correspondente. | O motor Leaflet integrado com OpenStreetMap (Nominatim) deve carregar o mapa rapidamente sem requisições bloqueadas de API. | `[ ] Sim  [ ] Não` |
| **TF-16** | **Upload de Fotos do Imóvel**<br>1. Abra um imóvel e adicione múltiplas imagens na galeria.<br>2. Defina uma foto como capa (thumbnail). | O card da thumb deve atualizar visualmente na hora (ganhando a estrela ou badge de Capa) refletindo a alteração. | `[ ] Sim  [ ] Não` |
| **TF-17** | **Funil de Vendas e Kanban de Leads**<br>1. Vá até `/app/leads`.<br>2. Arraste um lead de uma coluna de status para outra. | O lead deve atualizar sua coluna no banco de dados e persistir a alteração imediatamente após o drop. | `[ ] Sim  [ ] Não` |

---

## ⚙️ Seção 2: Testes de Serviços e Processamento (Backend & Integrações)

### 1. Comunicação do Supabase, Schemas e Tabelas de Planos
Garante a consistência na captura de dados e na proteção contra informações vazias vindas do banco de dados relacional.

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TB-01** | **Carregamento de Planos via Supabase**<br>1. Abra a rede (`Network` no DevTools).<br>2. Acesse `/planos`. | A requisição de select na tabela `public.plans` deve retornar status HTTP `200` acompanhado do JSON dos planos ativos. | `[ ] Sim  [ ] Não` |
| **TB-02** | **Resiliência com Banco de Dados Vazio**<br>1. Crie um cenário em que a tabela de planos retorne vazia.<br>2. Verifique o layout da interface. | O backend do componente deve acionar a lista `FALLBACK_PLANS` estática em tempo de execução para evitar que a tela fique em branco. | `[ ] Sim  [ ] Não` |
| **TB-03** | **Atribuição das Roles de Super Admin**<br>1. Logue com uma conta cadastrada como Super Admin.<br>2. Navegue para o painel de administração em `/admin`. | O sistema deve resolver a Promise de `loadRoles` antes de setar `loading = false`, impedindo redirecionamentos prematuros indesejados. | `[ ] Sim  [ ] Não` |

---

### 2. Jobs Automatizados, Segurança de Endpoints e Mensageria
Valida os processos periódicos executados pelo servidor (Cron Jobs) e a integridade de segurança de acessos.

| ID | Cenário de Teste / Passo a Passo | Resultado Esperado | Status (Sim/Não) |
| :--- | :--- | :--- | :---: |
| **TB-04** | **Bloqueio de Cron Ends sem API Key**<br>1. Faça uma requisição direta via HTTP Client externo (Postman/cURL) ao endpoint `/api/public/cron/buscas-alertas` omitindo o cabeçalho `apikey`. | Deve retornar status HTTP `401 Unauthorized` e bloquear a execução do script. | `[ ] Sim  [ ] Não` |
| **TB-05** | **Prevenção de Bypass com Segredo Nulo**<br>1. Simule temporariamente um ambiente onde `SUPABASE_PUBLISHABLE_KEY` esteja nulo.<br>2. Envie uma requisição vazia para a rota do Cron. | A rota deve manter-se segura bloqueando as requisições em vez de cair na facilidade de aceitar comparação vazia por bypass. | `[ ] Sim  [ ] Não` |
| **TB-06** | **Fuso Horário de Agendamento de Visitas**<br>1. Agende uma visita para as 21:30 no fuso de Brasília (UTC-3).<br>2. Abra o calendário de tarefas do corretor. | O compromisso deve permanecer fixo no respectivo dia selecionado pelo cliente, eliminando o shift que empurrava para o dia seguinte. | `[ ] Sim  [ ] Não` |
| **TB-07** | **Envio de Notificações Transacionais**<br>1. Cadastre um novo lead focado em busca de imóveis.<br>2. Forneça imóveis que atendam essa busca e verifique o processamento de envio de e-mails. | O sistema deve computar e formatar com perfeição o layout de notificação, enviando as informações do lead e o rodapé da marca. | `[ ] Sim  [ ] Não` |

---

## 📝 Notas Gerais e Instruções para o Validador

1. **Instruções de Navegação**: Realize os testes preferencialmente usando o navegador em modo de desenvolvimento (Inspecionar habilitado) de forma que possíveis erros na aba Console possam ser observados em tempo real.
2. **Ambiente Recomendado**: Os testes do frontend e as respostas de geocoding devem ser homologados tanto em telas desktop clássicas (resolução de 1920x1080) quanto em simulações mobile integradas (como telas de celulares iPhone/Android de ~390px a 440px de largura).
3. **Persistência de Dados**: Garanta que as chamadas às tabelas como `plans`, `tenants` e `leads` permaneçam ativas no Supabase para que a experiência do usuário conte sempre com dados mockados atualizados de modo a manter a operação íntegra.
