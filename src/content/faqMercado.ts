// Guia de perguntas frequentes sobre mercado imobiliário — fonte única de:
//   - respostas INSTANTÂNEAS do assistente de IA do portal (busca local, sem
//     chamar modelo nenhum — ver buscarFaq abaixo);
//   - página pública indexada /perguntas-frequentes (FAQPage schema.org);
//   - contexto de referência para a IA quando a pergunta não está aqui.
//
// Conteúdo curado (não gerado on-the-fly): respostas gerais, baseadas na
// legislação federal vigente. Valores que variam por município/banco/tabela
// de cartório são dados como faixas, sempre com a orientação de confirmar.
// Ao editar, mantenha respostas curtas (3–6 frases) e objetivas.

export type FaqCategoria =
  | "Compra e documentação"
  | "Financiamento"
  | "Impostos e custos"
  | "Aluguel"
  | "Venda"
  | "Investimento e mercado";

export type FaqLink = { label: string; href: string };

export type FaqItem = {
  id: string;
  categoria: FaqCategoria;
  pergunta: string;
  /** Outras formas comuns de fazer a mesma pergunta (melhoram a busca). */
  variacoes: string[];
  resposta: string;
  links?: FaqLink[];
};

export const FAQ_CATEGORIAS: FaqCategoria[] = [
  "Compra e documentação",
  "Financiamento",
  "Impostos e custos",
  "Aluguel",
  "Venda",
  "Investimento e mercado",
];

const L = {
  calcItbi: { label: "Calculadora de ITBI", href: "/calculadora-itbi" },
  calcFin: { label: "Simulador de financiamento", href: "/calculadora-financiamento" },
  calcAval: { label: "Calculadora de avaliação", href: "/calculadora-avaliacao" },
  calcMud: { label: "Calculadora de mudança", href: "/calculadora-mudanca" },
  blogItbi: {
    label: "Guia completo do ITBI",
    href: "/blog/itbi-o-que-e-como-calcular-e-quando-pagar",
  },
  blogSacPrice: {
    label: "SAC ou Price: qual escolher",
    href: "/blog/financiamento-sac-e-price-qual-escolher-em-2026",
  },
  blogDocsFin: {
    label: "Documentos para financiar",
    href: "/blog/documentos-necessarios-para-financiar-um-imovel",
  },
  blogCredito: {
    label: "Como funciona a análise de crédito",
    href: "/blog/analise-de-credito-imobiliario-como-funciona",
  },
  blogPlanta: {
    label: "Comprar na planta: vantagens e riscos",
    href: "/blog/comprar-imovel-na-planta-no-litoral-de-sp-vantagens-riscos-e-como-proteger-seu-investimento",
  },
  blogLocacao: { label: "Lei de locação de imóveis", href: "/blog/nova-lei-locacao-de-imoveis" },
  blogAvaliar: {
    label: "Como avaliar um imóvel antes de vender",
    href: "/blog/como-avaliar-o-valor-de-um-imovel-antes-de-vender",
  },
  blogMudanca: {
    label: "Quanto custa uma mudança",
    href: "/blog/quanto-custa-uma-mudanca-residencial",
  },
  blogTemporada: {
    label: "Aluguel por temporada no litoral",
    href: "/blog/aluguel-por-temporada-no-litoral-sul-de-sp-o-guia-para-transformar-seu-imovel-em-renda-passiva-real",
  },
  blogSelic: { label: "Selic e financiamento", href: "/blog/selic-14-financiamento" },
  buscar: { label: "Buscar imóveis", href: "/buscar" },
} satisfies Record<string, FaqLink>;

export const FAQ_MERCADO: FaqItem[] = [
  // ───────────────────────── Impostos e custos ─────────────────────────
  {
    id: "o-que-e-itbi",
    categoria: "Impostos e custos",
    pergunta: "O que é ITBI?",
    variacoes: [
      "itbi",
      "imposto de transmissão",
      "imposto sobre transmissão de bens imóveis",
      "quanto é o itbi",
      "como calcular o itbi",
      "alíquota do itbi",
    ],
    resposta:
      "O ITBI (Imposto sobre Transmissão de Bens Imóveis) é um imposto municipal cobrado quando um imóvel é transferido de uma pessoa para outra por compra e venda. Cada prefeitura define a sua alíquota — em geral entre 2% e 3% — aplicada sobre o maior valor entre o preço da negociação e o valor de referência do município. Ele precisa ser pago antes da escritura ou do registro. Alguns municípios cobram alíquota menor sobre a parte financiada pelo SFH.",
    links: [L.calcItbi, L.blogItbi],
  },
  {
    id: "quem-paga-itbi",
    categoria: "Impostos e custos",
    pergunta: "Quem paga o ITBI, o comprador ou o vendedor?",
    variacoes: ["quem paga o itbi", "itbi é do comprador", "itbi vendedor paga"],
    resposta:
      "Pela legislação municipal, o responsável pelo ITBI é o comprador (quem adquire o imóvel). Nada impede que as partes combinem outra divisão no contrato, mas, se nada for acordado, a conta é do comprador e o pagamento é exigido antes da escritura ou do registro.",
    links: [L.calcItbi],
  },
  {
    id: "custos-escritura-registro",
    categoria: "Impostos e custos",
    pergunta: "Quanto custa a escritura e o registro do imóvel?",
    variacoes: [
      "custo da escritura",
      "custo do registro",
      "taxas de cartório",
      "quanto gasto com cartório",
      "custos para comprar um imóvel",
      "despesas da compra",
      "emolumentos",
    ],
    resposta:
      "Os valores de escritura (Tabelionato de Notas) e registro (Cartório de Registro de Imóveis) seguem tabelas de emolumentos de cada estado e crescem conforme o valor do imóvel. Como referência, ITBI + escritura + registro costumam somar algo entre 3% e 5% do valor do imóvel. Na compra financiada por banco, o próprio contrato bancário tem força de escritura pública, o que dispensa o tabelionato — sobram o ITBI e o registro.",
    links: [L.calcItbi],
  },
  {
    id: "o-que-e-laudemio",
    categoria: "Impostos e custos",
    pergunta: "O que é laudêmio?",
    variacoes: ["laudemio", "terreno de marinha", "taxa da união", "spu"],
    resposta:
      "Laudêmio é uma taxa paga à União quando se vende um imóvel localizado em terreno de marinha (faixa próxima ao mar e a rios e lagoas com influência de maré, comum em cidades litorâneas). Corresponde a 5% do valor do terreno e das benfeitorias e, em regra, é pago por quem vende. Antes de fechar negócio no litoral, vale consultar na matrícula ou na Secretaria do Patrimônio da União (SPU) se o imóvel está nessa situação.",
  },
  {
    id: "iptu-dividas",
    categoria: "Impostos e custos",
    pergunta: "Se o imóvel tiver IPTU atrasado, quem paga?",
    variacoes: ["iptu atrasado", "divida de iptu", "debito de iptu", "iptu em aberto"],
    resposta:
      "Dívidas de IPTU acompanham o imóvel (são chamadas de obrigações “propter rem”): se não forem quitadas, podem ser cobradas do novo dono. Por isso, antes da compra, peça a certidão negativa de débitos de IPTU na prefeitura e combine em contrato que o vendedor quita tudo o que for anterior à venda.",
  },
  {
    id: "imposto-de-renda-venda",
    categoria: "Impostos e custos",
    pergunta: "Pago imposto de renda quando vendo um imóvel?",
    variacoes: [
      "ganho de capital",
      "imposto na venda do imovel",
      "ir na venda",
      "isencao imposto de renda venda imovel",
      "lucro na venda do imovel",
    ],
    resposta:
      "Sim, se houver lucro (ganho de capital): a alíquota é de 15% sobre o lucro até R$ 5 milhões, com faixas maiores acima disso. Há isenções importantes: venda do único imóvel por até R$ 440 mil, sem ter vendido outro nos últimos 5 anos; e quando o valor da venda é usado para comprar outro imóvel residencial em até 180 dias. O imposto é calculado no programa GCAP da Receita e pago até o último dia útil do mês seguinte à venda.",
  },

  // ───────────────────────── Compra e documentação ─────────────────────────
  {
    id: "documentos-para-comprar",
    categoria: "Compra e documentação",
    pergunta: "Quais documentos preciso para comprar um imóvel?",
    variacoes: [
      "documentos para compra",
      "documentacao para comprar imovel",
      "o que pedir do vendedor",
      "certidoes para comprar imovel",
      "como comprar um imovel com seguranca",
    ],
    resposta:
      "Do comprador: RG, CPF, certidão de estado civil e comprovante de residência. Do imóvel: matrícula atualizada com certidão de ônus reais (mostra dono, penhoras e hipotecas), certidão negativa de IPTU e declaração de quitação do condomínio. Do vendedor: certidões negativas (federal, estadual, trabalhista, de protestos e de ações cíveis), que ajudam a garantir que a venda não será questionada por credores.",
    links: [L.buscar],
  },
  {
    id: "escritura-x-registro",
    categoria: "Compra e documentação",
    pergunta: "Qual a diferença entre escritura e registro?",
    variacoes: [
      "escritura e registro",
      "escritura ou registro",
      "o que e escritura",
      "matricula do imovel",
    ],
    resposta:
      "A escritura é o documento, feito no Tabelionato de Notas, que formaliza a compra e venda. O registro é a anotação dessa escritura na matrícula do imóvel, no Cartório de Registro de Imóveis — e é ele que transfere de fato a propriedade. Por isso o ditado: “quem não registra não é dono”. Só ter a escritura (ou um contrato de gaveta) não garante a posse do imóvel perante terceiros.",
  },
  {
    id: "matricula-imovel",
    categoria: "Compra e documentação",
    pergunta: "O que é a matrícula do imóvel e como consultar?",
    variacoes: ["matricula", "certidao de matricula", "onus reais", "consultar dono do imovel"],
    resposta:
      "A matrícula é a “certidão de nascimento” do imóvel: um número único no Cartório de Registro de Imóveis com todo o histórico — donos, vendas, financiamentos, penhoras e hipotecas. Qualquer pessoa pode pedir uma cópia atualizada (certidão de inteiro teor) no cartório da região ou pelos serviços eletrônicos dos cartórios. É o primeiro documento a checar antes de negociar.",
  },
  {
    id: "contrato-de-gaveta",
    categoria: "Compra e documentação",
    pergunta: "Contrato de gaveta é seguro?",
    variacoes: ["contrato de gaveta", "compra sem escritura", "imovel sem registro"],
    resposta:
      "Não é recomendado. O contrato de gaveta é um acordo particular sem registro em cartório: a propriedade continua no nome do vendedor, o que expõe o comprador a penhoras, dívidas e até a uma nova venda do mesmo imóvel para outra pessoa. O caminho seguro é sempre escritura (quando exigida) e registro na matrícula.",
  },
  {
    id: "comprar-na-planta",
    categoria: "Compra e documentação",
    pergunta: "Vale a pena comprar imóvel na planta?",
    variacoes: [
      "imovel na planta",
      "lancamento imobiliario",
      "comprar lancamento",
      "riscos de comprar na planta",
      "incc",
    ],
    resposta:
      "Pode valer: o preço costuma ser menor que o de um imóvel pronto e a entrada é parcelada durante a obra. Os pontos de atenção são a correção das parcelas pelo INCC (índice da construção) até a entrega, o histórico da construtora, o registro da incorporação no cartório e se o empreendimento tem patrimônio de afetação. Na entrega das chaves, o saldo é pago à vista ou financiado com o banco (repasse).",
    links: [L.blogPlanta],
  },
  {
    id: "distrato-planta",
    categoria: "Compra e documentação",
    pergunta: "Desisti de um imóvel na planta, quanto recebo de volta?",
    variacoes: [
      "distrato",
      "desistir do imovel na planta",
      "cancelar compra na planta",
      "lei do distrato",
    ],
    resposta:
      "Pela Lei do Distrato (Lei 13.786/2018), a construtora pode reter até 25% do que foi pago, além da comissão de corretagem, se a desistência for do comprador. Em empreendimentos com patrimônio de afetação, a retenção pode chegar a 50%. Se o atraso ou o problema for da construtora, a situação se inverte e o comprador pode ter direito à devolução integral corrigida.",
    links: [L.blogPlanta],
  },
  {
    id: "patrimonio-de-afetacao",
    categoria: "Compra e documentação",
    pergunta: "O que é patrimônio de afetação?",
    variacoes: ["patrimonio de afetacao", "afetacao", "construtora falir"],
    resposta:
      "É um regime em que o dinheiro e os bens de um empreendimento ficam separados do restante do patrimônio da construtora. Se a construtora tiver problemas financeiros, os recursos daquela obra não podem ser usados para pagar outras dívidas dela, o que protege quem comprou na planta. A informação consta no registro da incorporação, no cartório.",
    links: [L.blogPlanta],
  },
  {
    id: "condominio-atrasado",
    categoria: "Compra e documentação",
    pergunta: "Se o apartamento tiver condomínio atrasado, quem paga?",
    variacoes: [
      "condominio atrasado",
      "divida de condominio",
      "debito condominial",
      "taxa de condominio em aberto",
    ],
    resposta:
      "Assim como o IPTU, a dívida de condomínio acompanha o imóvel: o novo proprietário pode ser cobrado pelos atrasados. Antes de assinar, peça ao síndico ou à administradora a declaração de quitação de débitos condominiais e deixe no contrato que débitos anteriores são de responsabilidade do vendedor.",
  },
  {
    id: "corretor-credenciado",
    categoria: "Compra e documentação",
    pergunta: "Como saber se um corretor é credenciado?",
    variacoes: [
      "creci",
      "consultar creci",
      "corretor de imoveis registrado",
      "corretor e confiavel",
    ],
    resposta:
      "Todo corretor e toda imobiliária precisam de registro ativo no CRECI (Conselho Regional de Corretores de Imóveis) do estado. A consulta é gratuita no site do CRECI da sua região, pelo nome ou número de inscrição. Desconfie de quem não informa o CRECI ou pede pagamentos antecipados fora de contrato.",
  },

  // ───────────────────────── Financiamento ─────────────────────────
  {
    id: "sac-ou-price",
    categoria: "Financiamento",
    pergunta: "Qual a diferença entre SAC e Price?",
    variacoes: [
      "sac",
      "price",
      "tabela price",
      "sistema de amortizacao",
      "qual melhor sac ou price",
      "financiamento sac",
    ],
    resposta:
      "No SAC (Sistema de Amortização Constante) as parcelas começam mais altas e diminuem com o tempo, e o total de juros pago é menor. Na Tabela Price as parcelas são fixas — começam menores, o que ajuda a caber na renda — mas o custo total do financiamento fica maior. A maioria dos bancos oferece SAC como padrão no crédito imobiliário.",
    links: [L.calcFin, L.blogSacPrice],
  },
  {
    id: "renda-para-financiar",
    categoria: "Financiamento",
    pergunta: "Quanto da minha renda posso comprometer no financiamento?",
    variacoes: [
      "renda para financiar",
      "quanto preciso ganhar para financiar",
      "comprometimento de renda",
      "parcela maxima",
      "30 por cento da renda",
    ],
    resposta:
      "Os bancos costumam limitar a primeira parcela a cerca de 30% da renda bruta familiar (é possível somar a renda de mais de uma pessoa). Na prática, para uma parcela de R$ 3.000, a renda comprovada precisa ser de aproximadamente R$ 10.000. Cada banco faz a própria análise de crédito, considerando também outras dívidas e o histórico do comprador.",
    links: [L.calcFin, L.blogCredito],
  },
  {
    id: "entrada-minima",
    categoria: "Financiamento",
    pergunta: "Qual é a entrada mínima para financiar um imóvel?",
    variacoes: [
      "entrada",
      "valor de entrada",
      "quanto de entrada",
      "financiar 100%",
      "cota de financiamento",
    ],
    resposta:
      "Em geral os bancos financiam de 70% a 80% do valor do imóvel (considerando o menor valor entre o preço de compra e a avaliação do banco), então a entrada fica entre 20% e 30%. Programas habitacionais e alguns bancos podem ter condições diferentes. O FGTS pode ser usado para compor a entrada, se você cumprir as regras.",
    links: [L.calcFin],
  },
  {
    id: "documentos-para-financiar",
    categoria: "Financiamento",
    pergunta: "Quais documentos preciso para financiar um imóvel?",
    variacoes: ["documentos financiamento", "documentacao para financiar", "o que o banco pede"],
    resposta:
      "Normalmente o banco pede: RG e CPF, certidão de estado civil (casamento ou nascimento), comprovante de residência, comprovantes de renda (holerites recentes ou, para autônomos, declaração de imposto de renda e extratos) e o extrato do FGTS, se for usá-lo. Depois da aprovação do crédito, entram os documentos do imóvel e do vendedor.",
    links: [L.blogDocsFin],
  },
  {
    id: "usar-fgts",
    categoria: "Financiamento",
    pergunta: "Posso usar o FGTS para comprar um imóvel?",
    variacoes: [
      "fgts",
      "usar fgts",
      "fgts na entrada",
      "fgts para amortizar",
      "regras fgts imovel",
    ],
    resposta:
      "Pode, se cumprir as regras: ter ao menos 3 anos de trabalho com carteira assinada sob o regime do FGTS (somando todos os empregos); o imóvel ser residencial urbano, para moradia própria, na cidade onde você mora ou trabalha; não ter outro imóvel residencial nessa mesma cidade (ou região metropolitana); e não ter financiamento ativo no SFH. O FGTS pode ir para a entrada, para amortizar ou quitar o saldo.",
    links: [L.calcFin],
  },
  {
    id: "avaliacao-banco",
    categoria: "Financiamento",
    pergunta: "O que é a avaliação do imóvel feita pelo banco?",
    variacoes: [
      "laudo de avaliacao",
      "vistoria do banco",
      "avaliacao do banco menor",
      "engenheiro do banco",
    ],
    resposta:
      "Antes de liberar o crédito, o banco envia um engenheiro ou arquiteto para avaliar o imóvel e emitir um laudo com o valor de mercado. O financiamento é calculado sobre o menor valor entre o preço combinado e o valor avaliado — se a avaliação vier abaixo do preço, a diferença precisa ser coberta com uma entrada maior.",
  },
  {
    id: "cet-juros",
    categoria: "Financiamento",
    pergunta: "Como comparar as taxas de financiamento entre bancos?",
    variacoes: [
      "taxa de juros",
      "cet",
      "custo efetivo total",
      "melhor banco para financiar",
      "juros financiamento imobiliario",
    ],
    resposta:
      "Compare o CET (Custo Efetivo Total), não só a taxa de juros anunciada. O CET soma juros, seguros obrigatórios (MIP e DFI), tarifas e outros encargos, e mostra o custo real. Peça simulações com o mesmo valor, prazo e sistema de amortização em pelo menos três bancos. A taxa Selic influencia o patamar geral dos juros do crédito imobiliário.",
    links: [L.calcFin, L.blogSelic],
  },
  {
    id: "seguros-financiamento",
    categoria: "Financiamento",
    pergunta: "Quais seguros são obrigatórios no financiamento?",
    variacoes: ["mip", "dfi", "seguro do financiamento", "seguro habitacional"],
    resposta:
      "Dois seguros são obrigatórios e vêm embutidos na parcela: o MIP (Morte e Invalidez Permanente), que quita ou abate o saldo devedor em caso de morte ou invalidez do comprador, e o DFI (Danos Físicos ao Imóvel), que cobre danos como incêndio e desabamento. Você pode contratar esses seguros com outra seguradora, se encontrar condições melhores.",
  },
  {
    id: "amortizar-financiamento",
    categoria: "Financiamento",
    pergunta: "Vale a pena amortizar ou quitar o financiamento antes?",
    variacoes: [
      "amortizar",
      "amortizacao antecipada",
      "quitar financiamento",
      "reduzir prazo ou parcela",
    ],
    resposta:
      "Sim, você tem direito de antecipar pagamentos com desconto proporcional dos juros. Ao amortizar, normalmente escolhe entre reduzir o prazo (economiza mais juros no total) ou reduzir o valor da parcela (alivia o orçamento mensal). O FGTS também pode ser usado para amortizar, respeitadas as regras do fundo.",
    links: [L.calcFin],
  },
  {
    id: "portabilidade",
    categoria: "Financiamento",
    pergunta: "Posso trocar meu financiamento para outro banco?",
    variacoes: [
      "portabilidade",
      "portabilidade de credito imobiliario",
      "mudar financiamento de banco",
      "refinanciar",
    ],
    resposta:
      "Sim, pela portabilidade de crédito: outro banco quita sua dívida atual e você passa a pagar a ele, em condições melhores (geralmente juros menores). O banco original não pode impedir, mas pode fazer uma contraproposta. Compare o CET da nova proposta e os custos de registro da operação antes de decidir.",
  },
  {
    id: "minha-casa-minha-vida",
    categoria: "Financiamento",
    pergunta: "Como funciona o Minha Casa Minha Vida?",
    variacoes: [
      "mcmv",
      "minha casa minha vida",
      "programa habitacional",
      "subsidio para comprar imovel",
    ],
    resposta:
      "É o programa habitacional do governo federal que oferece juros menores e, nas faixas de renda mais baixas, subsídio (desconto) na compra do imóvel. As condições dependem da renda familiar e da região, e o imóvel precisa estar dentro do valor-limite da faixa. A contratação é feita principalmente pela Caixa, que faz a simulação e confirma o enquadramento.",
  },
  {
    id: "consorcio-ou-financiamento",
    categoria: "Financiamento",
    pergunta: "Consórcio ou financiamento: qual é melhor?",
    variacoes: ["consorcio", "consorcio imobiliario", "consorcio vale a pena"],
    resposta:
      "No financiamento você recebe o imóvel logo, mas paga juros. No consórcio não há juros (há taxa de administração), porém o crédito só sai por sorteio ou lance, o que pode demorar anos. O consórcio costuma fazer sentido para quem não tem pressa e quer planejar; o financiamento, para quem precisa do imóvel agora.",
  },

  // ───────────────────────── Aluguel ─────────────────────────
  {
    id: "garantias-aluguel",
    categoria: "Aluguel",
    pergunta: "Quais são as garantias para alugar um imóvel?",
    variacoes: [
      "fiador",
      "caucao",
      "seguro fianca",
      "titulo de capitalizacao",
      "garantia locaticia",
      "alugar sem fiador",
    ],
    resposta:
      "A Lei do Inquilinato prevê: fiador, caução (depósito de até 3 aluguéis), seguro-fiança e título de capitalização. O contrato só pode exigir uma delas — pedir duas garantias ao mesmo tempo é proibido. Para quem não tem fiador, seguro-fiança e caução são as alternativas mais comuns.",
    links: [L.blogLocacao],
  },
  {
    id: "despesas-inquilino-proprietario",
    categoria: "Aluguel",
    pergunta: "No aluguel, quem paga IPTU e condomínio?",
    variacoes: [
      "iptu aluguel",
      "condominio inquilino",
      "quem paga condominio no aluguel",
      "despesas extraordinarias",
    ],
    resposta:
      "Pela lei, o inquilino paga as despesas ordinárias de condomínio (limpeza, portaria, manutenção do dia a dia) e o proprietário paga as extraordinárias (obras estruturais, fundo de reserva, reformas). O IPTU é obrigação do proprietário, mas é muito comum o contrato transferi-lo ao inquilino — vale o que estiver escrito no contrato.",
    links: [L.blogLocacao],
  },
  {
    id: "multa-rescisao-aluguel",
    categoria: "Aluguel",
    pergunta: "Qual é a multa para sair do aluguel antes do fim do contrato?",
    variacoes: [
      "multa rescisoria",
      "sair do aluguel antes",
      "quebrar contrato de aluguel",
      "multa proporcional",
    ],
    resposta:
      "A multa prevista no contrato (comumente 3 aluguéis) deve ser cobrada de forma proporcional ao tempo que falta para o fim do contrato. O inquilino fica dispensado da multa se precisar se mudar por transferência de trabalho determinada pelo empregador, desde que avise o proprietário por escrito com 30 dias de antecedência.",
    links: [L.blogLocacao],
  },
  {
    id: "reajuste-aluguel",
    categoria: "Aluguel",
    pergunta: "Como funciona o reajuste do aluguel?",
    variacoes: ["reajuste", "igpm", "ipca aluguel", "aumento do aluguel"],
    resposta:
      "O aluguel só pode ser reajustado uma vez a cada 12 meses, pelo índice definido no contrato — os mais usados são o IGP-M e o IPCA. Fora disso, um novo valor só vale por acordo entre as partes ou, após 3 anos, por ação revisional na Justiça para ajustar o aluguel ao preço de mercado.",
  },
  {
    id: "prazo-contrato-aluguel",
    categoria: "Aluguel",
    pergunta: "Qual o prazo ideal de um contrato de aluguel residencial?",
    variacoes: ["prazo do contrato", "30 meses", "denuncia vazia", "contrato de 12 meses"],
    resposta:
      "O mais comum é 30 meses: nesse prazo, ao fim do contrato, o proprietário pode pedir o imóvel de volta sem precisar justificar (a chamada denúncia vazia), avisando com 30 dias. Em contratos menores que 30 meses, depois que o prazo vence o contrato segue por tempo indeterminado e a retomada só é possível em situações previstas em lei, ou após 5 anos.",
    links: [L.blogLocacao],
  },
  {
    id: "vistoria-aluguel",
    categoria: "Aluguel",
    pergunta: "Para que serve a vistoria de entrada e saída?",
    variacoes: ["vistoria", "laudo de vistoria", "devolver imovel alugado", "estado do imovel"],
    resposta:
      "A vistoria registra, com descrição e fotos, o estado do imóvel na entrada do inquilino. Na saída é feita uma nova vistoria e o imóvel deve ser devolvido no mesmo estado, salvo o desgaste natural do uso. Ela evita discussões sobre danos e é a base para cobrar (ou contestar) reparos.",
  },
  {
    id: "aluguel-temporada",
    categoria: "Aluguel",
    pergunta: "Como funciona o aluguel por temporada?",
    variacoes: [
      "temporada",
      "aluguel de temporada",
      "airbnb",
      "alugar casa na praia",
      "aluguel curto",
    ],
    resposta:
      "O aluguel por temporada é para estadias de até 90 dias — férias, tratamento de saúde, cursos, obras na própria casa. Nessa modalidade, o proprietário pode receber o valor total adiantado. Em condomínios, verifique a convenção, que pode ter regras para hospedagens de curta duração.",
    links: [L.blogTemporada],
  },

  // ───────────────────────── Venda ─────────────────────────
  {
    id: "quanto-vale-meu-imovel",
    categoria: "Venda",
    pergunta: "Como saber quanto vale o meu imóvel?",
    variacoes: [
      "avaliar imovel",
      "valor do imovel",
      "preco do meu imovel",
      "quanto vale",
      "avaliacao de imovel",
    ],
    resposta:
      "O ponto de partida é comparar o preço do metro quadrado de imóveis parecidos (tamanho, padrão, idade e estado) na mesma região, e ajustar por diferenciais como vaga, andar, vista e lazer. Um corretor credenciado pode fazer um parecer de avaliação, e você pode ter uma estimativa rápida na nossa calculadora.",
    links: [L.calcAval, L.blogAvaliar],
  },
  {
    id: "documentos-para-vender",
    categoria: "Venda",
    pergunta: "Quais documentos preciso para vender meu imóvel?",
    variacoes: ["documentos para vender", "vender imovel documentacao", "certidoes do vendedor"],
    resposta:
      "Matrícula atualizada, IPTU quitado, declaração de quitação do condomínio (se houver), RG, CPF e certidão de estado civil do(s) proprietário(s) e as certidões negativas pessoais (federal, estadual, trabalhista, de protestos e de ações cíveis). Se o imóvel ainda estiver financiado, é preciso quitar o saldo ou fazer a transferência com o banco.",
  },
  {
    id: "comissao-corretor",
    categoria: "Venda",
    pergunta: "Quanto é a comissão do corretor e quem paga?",
    variacoes: [
      "comissao",
      "honorarios do corretor",
      "porcentagem do corretor",
      "quem paga o corretor",
    ],
    resposta:
      "As tabelas de honorários dos CRECIs regionais costumam indicar entre 6% e 8% do valor da venda, e em geral quem paga é o vendedor — mas o percentual e o responsável podem ser negociados e devem estar no contrato. Na locação, é comum o valor equivaler ao primeiro aluguel.",
  },

  // ───────────────────────── Investimento e mercado ─────────────────────────
  {
    id: "comprar-ou-alugar",
    categoria: "Investimento e mercado",
    pergunta: "Vale mais a pena comprar ou alugar?",
    variacoes: ["comprar ou alugar", "aluguel ou financiamento", "vale a pena comprar imovel"],
    resposta:
      "Depende do seu momento. Comprar traz patrimônio e estabilidade, mas exige entrada e compromete a renda por muitos anos. Alugar dá flexibilidade para mudar e deixa o dinheiro livre para investir. Uma conta útil é comparar o aluguel anual com o que o valor do imóvel renderia investido e com os juros do financiamento — e considerar quanto tempo você pretende ficar.",
    links: [L.calcFin, L.buscar],
  },
  {
    id: "imovel-na-praia-investimento",
    categoria: "Investimento e mercado",
    pergunta: "Imóvel na praia é um bom investimento?",
    variacoes: [
      "investir no litoral",
      "apartamento na praia",
      "imovel no litoral",
      "praia grande investimento",
      "renda com aluguel na praia",
    ],
    resposta:
      "Pode ser, combinando uso próprio e renda com aluguel por temporada, principalmente em cidades próximas a grandes centros e com boa infraestrutura. Avalie a distância da praia, o condomínio (taxa e regras para temporada), a sazonalidade da demanda e custos como IPTU e manutenção. No litoral, confira também se há laudêmio (terreno de marinha).",
    links: [L.blogTemporada, L.buscar],
  },
  {
    id: "custos-mudanca",
    categoria: "Investimento e mercado",
    pergunta: "Quanto custa fazer uma mudança?",
    variacoes: ["mudanca", "custo de mudanca", "empresa de mudanca", "frete mudanca"],
    resposta:
      "O custo depende principalmente do volume de móveis, da distância, dos andares (com ou sem elevador) e de serviços extras como embalagem e montagem. Peça orçamentos com visita técnica a pelo menos três empresas e confira se o seguro de transporte está incluído. Nossa calculadora dá uma estimativa rápida.",
    links: [L.calcMud, L.blogMudanca],
  },
];

// ─────────────────────────────── busca local ───────────────────────────────

const STOPWORDS = new Set(
  "a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro por com sem que se eu meu minha meus minhas voce vc qual quais como quanto quanta quantos quantas quando onde e ou ao aos sobre ser e é tem ter posso pode preciso devo vale pena isso esse essa este esta mais menos muito muita".split(
    " ",
  ),
);

export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizarTexto(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Radical simples (plural/flexões comuns) — "financiamentos" ≈ "financiamento"
const radical = (t: string) => t.replace(/(oes|aes|ais|eis|ns|s)$/, "").slice(0, 7);

type Indexado = { item: FaqItem; frases: string[]; radicais: Set<string> };

const INDICE: Indexado[] = FAQ_MERCADO.map((item) => {
  const frases = [item.pergunta, ...item.variacoes].map(normalizarTexto);
  const radicais = new Set(frases.flatMap((f) => tokens(f)).map(radical));
  return { item, frases, radicais };
});

export type FaqResultado = { item: FaqItem; score: number };

/**
 * Busca local e instantânea no guia. Score em [0, 1]:
 *  - frase de variação contida na pergunta (ex.: "itbi") pesa mais;
 *  - senão, cobertura dos termos da pergunta pelos termos do item.
 * Use >= FAQ_SCORE_CONFIANTE para responder direto.
 */
export function buscarFaq(texto: string, limite = 5): FaqResultado[] {
  const q = normalizarTexto(texto);
  const qTokens = tokens(texto);
  if (!q || qTokens.length === 0) return [];
  const qRad = qTokens.map(radical);

  const resultados = INDICE.map(({ item, frases, radicais }) => {
    // 1. Frase inteira de uma variação aparece na pergunta (ou vice-versa)
    let frase = 0;
    for (const f of frases) {
      if (f.length < 3) continue;
      if (q === f) frase = Math.max(frase, 1);
      else if (q.includes(f))
        frase = Math.max(frase, 0.55 + Math.min(f.length / q.length, 1) * 0.4);
      else if (f.includes(q) && q.length >= 4)
        frase = Math.max(frase, 0.5 + (q.length / f.length) * 0.4);
    }
    // 2. Cobertura de termos
    const acertos = qRad.filter((r) => radicais.has(r)).length;
    const cobertura = acertos / qRad.length;
    const score = Math.min(1, Math.max(frase, cobertura * 0.9));
    return { item, score };
  })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score);

  return resultados.slice(0, limite);
}

/** A partir deste score a resposta curada é mostrada direto, sem IA. */
export const FAQ_SCORE_CONFIANTE = 0.6;

export function faqPorId(id: string): FaqItem | undefined {
  return FAQ_MERCADO.find((f) => f.id === id);
}
