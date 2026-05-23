export type BuiltinTemplate = {
  slug: string;
  nome: string;
  tipo: "venda" | "locacao" | "permuta" | "parceria" | "administracao" | "prestacao_servico" | "outro";
  descricao: string;
  conteudo: string;
};

const ASSINATURAS = `
<p style="margin-top:48px">E, por estarem assim justos e contratados, assinam o presente em duas vias de igual teor.</p>
<p style="margin-top:24px">{{imovel.endereco_cidade}}, {{contrato.data_inicio}}.</p>
<p style="margin-top:48px">_____________________________________<br/>{{partes.vendedor}}{{partes.locador}}{{partes.parceiro_a}}</p>
<p style="margin-top:32px">_____________________________________<br/>{{partes.comprador}}{{partes.locatario}}{{partes.parceiro_b}}</p>
<p style="margin-top:32px">_____________________________________<br/>Testemunha 1</p>
<p style="margin-top:32px">_____________________________________<br/>Testemunha 2</p>
`;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    slug: "venda-padrao",
    nome: "Compra e Venda — Padrão",
    tipo: "venda",
    descricao: "Contrato de compromisso de compra e venda de imóvel, com pagamento à vista ou parcelado.",
    conteudo: `<h1 style="text-align:center">INSTRUMENTO PARTICULAR DE COMPROMISSO DE COMPRA E VENDA</h1>
<p><b>VENDEDOR(A):</b> {{partes.vendedor}}, doravante denominado VENDEDOR.</p>
<p><b>COMPRADOR(A):</b> {{partes.comprador}}, doravante denominado COMPRADOR.</p>
<p><b>INTERVENIENTE:</b> {{tenant.nome}}, imobiliária intermediadora.</p>
<h3>Cláusula 1ª — Do Imóvel</h3>
<p>O VENDEDOR é legítimo proprietário do imóvel <b>{{imovel.titulo}}</b>, código {{imovel.codigo_interno}}, situado em {{imovel.endereco}}.</p>
<h3>Cláusula 2ª — Do Preço</h3>
<p>O preço total da venda é de R$ {{contrato.valor}}, a ser pago conforme condições ajustadas entre as partes.</p>
<h3>Cláusula 3ª — Da Posse e Escritura</h3>
<p>A posse será transmitida ao COMPRADOR após a quitação integral do preço, e a escritura definitiva será lavrada em cartório indicado pelo COMPRADOR.</p>
<h3>Cláusula 4ª — Da Comissão</h3>
<p>A comissão de corretagem será paga à intermediária {{tenant.nome}} na forma acordada.</p>
<h3>Cláusula 5ª — Da Rescisão</h3>
<p>O descumprimento de qualquer cláusula sujeita a parte infratora à multa de 10% sobre o valor do contrato.</p>
<h3>Cláusula 6ª — Do Foro</h3>
<p>Fica eleito o foro da comarca do imóvel para dirimir quaisquer dúvidas.</p>
${ASSINATURAS}`,
  },
  {
    slug: "locacao-residencial",
    nome: "Locação Residencial",
    tipo: "locacao",
    descricao: "Contrato de locação residencial conforme Lei 8.245/91, com garantia e prazo determinado.",
    conteudo: `<h1 style="text-align:center">CONTRATO DE LOCAÇÃO RESIDENCIAL</h1>
<p><b>LOCADOR(A):</b> {{partes.locador}}.</p>
<p><b>LOCATÁRIO(A):</b> {{partes.locatario}}.</p>
<p><b>ADMINISTRADORA:</b> {{tenant.nome}}.</p>
<h3>Cláusula 1ª — Do Imóvel</h3>
<p>Locação do imóvel <b>{{imovel.titulo}}</b> ({{imovel.codigo_interno}}), localizado em {{imovel.endereco}}, destinado exclusivamente à finalidade residencial.</p>
<h3>Cláusula 2ª — Do Prazo</h3>
<p>O prazo de locação é de 30 (trinta) meses, com início em {{contrato.data_inicio}} e término em {{contrato.data_fim}}.</p>
<h3>Cláusula 3ª — Do Aluguel</h3>
<p>O aluguel mensal é de R$ {{contrato.valor}}, vencível no 5º dia útil de cada mês, reajustável anualmente pelo IGP-M (ou índice substituto).</p>
<h3>Cláusula 4ª — Dos Encargos</h3>
<p>Correrão por conta do LOCATÁRIO IPTU, condomínio, água, luz, gás e demais taxas referentes à utilização do imóvel.</p>
<h3>Cláusula 5ª — Da Garantia</h3>
<p>A presente locação é garantida por [fiador / caução / seguro-fiança], conforme termo anexo.</p>
<h3>Cláusula 6ª — Da Conservação e Devolução</h3>
<p>O LOCATÁRIO obriga-se a manter o imóvel em perfeito estado, devolvendo-o ao final do contrato nas mesmas condições recebidas.</p>
<h3>Cláusula 7ª — Das Multas</h3>
<p>Em caso de rescisão antecipada, aplicar-se-á a multa proporcional prevista no art. 4º da Lei 8.245/91.</p>
<h3>Cláusula 8ª — Do Foro</h3>
<p>Fica eleito o foro da situação do imóvel.</p>
${ASSINATURAS}`,
  },
  {
    slug: "locacao-comercial",
    nome: "Locação Comercial",
    tipo: "locacao",
    descricao: "Contrato de locação não residencial para fins comerciais, com cláusula de fundo de comércio.",
    conteudo: `<h1 style="text-align:center">CONTRATO DE LOCAÇÃO COMERCIAL</h1>
<p><b>LOCADOR:</b> {{partes.locador}}.</p>
<p><b>LOCATÁRIO:</b> {{partes.locatario}}.</p>
<h3>Cláusula 1ª — Objeto</h3>
<p>Locação não residencial do imóvel {{imovel.titulo}} ({{imovel.codigo_interno}}), em {{imovel.endereco}}, destinado à exploração da atividade comercial declarada pelo LOCATÁRIO.</p>
<h3>Cláusula 2ª — Prazo</h3>
<p>Prazo de 60 (sessenta) meses, de {{contrato.data_inicio}} a {{contrato.data_fim}}, podendo o LOCATÁRIO valer-se da ação renovatória nos termos da Lei 8.245/91.</p>
<h3>Cláusula 3ª — Aluguel e Reajuste</h3>
<p>Aluguel mensal de R$ {{contrato.valor}}, reajustado anualmente pelo IPCA.</p>
<h3>Cláusula 4ª — Benfeitorias</h3>
<p>As benfeitorias úteis e voluptuárias dependerão de prévia autorização escrita do LOCADOR e não geram direito à retenção ou indenização.</p>
<h3>Cláusula 5ª — Garantia</h3>
<p>A locação é garantida por [caução / fiança / seguro-fiança / carta de fiança bancária].</p>
<h3>Cláusula 6ª — Foro</h3>
<p>Fica eleito o foro da comarca do imóvel.</p>
${ASSINATURAS}`,
  },
  {
    slug: "parceria-imobiliarias",
    nome: "Parceria entre Imobiliárias",
    tipo: "parceria",
    descricao: "Acordo de parceria para captação/venda compartilhada de imóveis com divisão de comissão.",
    conteudo: `<h1 style="text-align:center">CONTRATO DE PARCERIA IMOBILIÁRIA</h1>
<p><b>PARCEIRA A (Captadora):</b> {{tenant.nome}}.</p>
<p><b>PARCEIRA B (Vendedora):</b> {{partes.parceiro_b}}.</p>
<h3>Cláusula 1ª — Objeto</h3>
<p>As partes ajustam parceria profissional para a divulgação, intermediação e venda/locação do(s) imóvel(is) abaixo identificados, com fundamento na Lei 6.530/78 e na Resolução COFECI 1.256/2012.</p>
<h3>Cláusula 2ª — Imóvel</h3>
<p>Imóvel objeto desta parceria: {{imovel.titulo}} ({{imovel.codigo_interno}}), {{imovel.endereco}}.</p>
<h3>Cláusula 3ª — Divisão de Comissão</h3>
<p>A comissão total será dividida na proporção de <b>50% (cinquenta por cento)</b> para cada parceira, salvo ajuste específico por escrito.</p>
<h3>Cláusula 4ª — Exclusividade e Sigilo</h3>
<p>As parceiras comprometem-se a tratar com sigilo informações de clientes e proprietários, não podendo negociar diretamente sem a anuência da outra parte pelo prazo de 12 (doze) meses.</p>
<h3>Cláusula 5ª — Vigência</h3>
<p>Esta parceria vigorará de {{contrato.data_inicio}} a {{contrato.data_fim}}, ou até a conclusão do negócio.</p>
<h3>Cláusula 6ª — Foro</h3>
<p>Fica eleito o foro da comarca de {{imovel.endereco_cidade}}.</p>
${ASSINATURAS}`,
  },
  {
    slug: "administracao-locacao",
    nome: "Administração de Imóvel para Locação",
    tipo: "administracao",
    descricao: "Contrato de administração entre proprietário e imobiliária para gestão de imóvel locado.",
    conteudo: `<h1 style="text-align:center">CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL</h1>
<p><b>PROPRIETÁRIO:</b> {{partes.locador}}.</p>
<p><b>ADMINISTRADORA:</b> {{tenant.nome}}.</p>
<h3>Cláusula 1ª — Objeto</h3>
<p>O PROPRIETÁRIO contrata a ADMINISTRADORA para promover a locação, cobrança e administração do imóvel {{imovel.titulo}} ({{imovel.codigo_interno}}), em {{imovel.endereco}}.</p>
<h3>Cláusula 2ª — Atribuições</h3>
<p>A ADMINISTRADORA prestará: divulgação, análise cadastral de pretendentes, elaboração de contratos, cobrança de aluguéis, repasse ao PROPRIETÁRIO, prestação de contas mensal e acompanhamento de manutenções.</p>
<h3>Cláusula 3ª — Taxa de Administração</h3>
<p>A ADMINISTRADORA fará jus à taxa equivalente a <b>10% (dez por cento)</b> sobre cada aluguel recebido, deduzida no momento do repasse.</p>
<h3>Cláusula 4ª — Taxa de Intermediação</h3>
<p>Pela intermediação locatícia, fica devida taxa equivalente ao valor de 1 (um) aluguel a cada nova locação.</p>
<h3>Cláusula 5ª — Repasse</h3>
<p>O repasse ao PROPRIETÁRIO ocorrerá em até 5 (cinco) dias úteis após o recebimento do aluguel, mediante depósito em conta indicada.</p>
<h3>Cláusula 6ª — Vigência e Rescisão</h3>
<p>Prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.</p>
${ASSINATURAS}`,
  },
  {
    slug: "exclusividade-venda",
    nome: "Autorização de Venda com Exclusividade",
    tipo: "prestacao_servico",
    descricao: "Autorização do proprietário para que a imobiliária comercialize o imóvel em regime exclusivo.",
    conteudo: `<h1 style="text-align:center">AUTORIZAÇÃO DE VENDA COM EXCLUSIVIDADE</h1>
<p><b>PROPRIETÁRIO:</b> {{partes.vendedor}}.</p>
<p><b>IMOBILIÁRIA:</b> {{tenant.nome}}.</p>
<h3>Cláusula 1ª — Objeto</h3>
<p>O PROPRIETÁRIO autoriza, com <b>exclusividade</b>, a IMOBILIÁRIA a oferecer à venda o imóvel {{imovel.titulo}} ({{imovel.codigo_interno}}), em {{imovel.endereco}}, pelo valor anunciado de R$ {{contrato.valor}}.</p>
<h3>Cláusula 2ª — Prazo</h3>
<p>O prazo de exclusividade é de 90 (noventa) dias, contados de {{contrato.data_inicio}}, renovável tacitamente por igual período, salvo manifestação em contrário.</p>
<h3>Cláusula 3ª — Comissão</h3>
<p>Concluído o negócio, será devida à IMOBILIÁRIA comissão de <b>6% (seis por cento)</b> sobre o valor da venda, ainda que o negócio seja efetivado diretamente pelo PROPRIETÁRIO durante a vigência da exclusividade.</p>
<h3>Cláusula 4ª — Obrigações</h3>
<p>A IMOBILIÁRIA divulgará o imóvel em seu site, portais parceiros e demais meios cabíveis, mantendo o PROPRIETÁRIO informado das propostas recebidas.</p>
<h3>Cláusula 5ª — Foro</h3>
<p>Fica eleito o foro da comarca do imóvel.</p>
${ASSINATURAS}`,
  },
  {
    slug: "permuta",
    nome: "Permuta de Imóveis",
    tipo: "permuta",
    descricao: "Contrato de permuta (troca) de imóveis entre duas partes, com ou sem torna em dinheiro.",
    conteudo: `<h1 style="text-align:center">CONTRATO DE PERMUTA DE IMÓVEIS</h1>
<p><b>PERMUTANTE A:</b> {{partes.parceiro_a}}.</p>
<p><b>PERMUTANTE B:</b> {{partes.parceiro_b}}.</p>
<h3>Cláusula 1ª — Objeto</h3>
<p>As partes ajustam, em caráter irrevogável, a permuta dos imóveis abaixo descritos, com fundamento no art. 533 do Código Civil.</p>
<h3>Cláusula 2ª — Imóvel A</h3>
<p>De propriedade do PERMUTANTE A: {{imovel.titulo}} ({{imovel.codigo_interno}}), {{imovel.endereco}}.</p>
<h3>Cláusula 3ª — Imóvel B</h3>
<p>De propriedade do PERMUTANTE B: [descrever imóvel B].</p>
<h3>Cláusula 4ª — Torna</h3>
<p>Em razão da diferença de valores, o PERMUTANTE [A/B] pagará ao outro a quantia de R$ {{contrato.valor}} a título de torna.</p>
<h3>Cláusula 5ª — Escritura</h3>
<p>As escrituras definitivas serão lavradas simultaneamente, em até 60 (sessenta) dias, perante o cartório indicado de comum acordo.</p>
<h3>Cláusula 6ª — Foro</h3>
<p>Fica eleito o foro da comarca de {{imovel.endereco_cidade}}.</p>
${ASSINATURAS}`,
  },
  {
    slug: "distrato",
    nome: "Distrato / Rescisão Amigável",
    tipo: "outro",
    descricao: "Termo de distrato para rescisão amigável de contrato de locação ou compra e venda.",
    conteudo: `<h1 style="text-align:center">TERMO DE DISTRATO</h1>
<p>Pelo presente instrumento, as partes abaixo identificadas, de comum acordo, resolvem rescindir o contrato originalmente celebrado em {{contrato.data_inicio}}, referente ao imóvel {{imovel.titulo}} ({{imovel.codigo_interno}}), em {{imovel.endereco}}.</p>
<h3>Cláusula 1ª — Quitação</h3>
<p>As partes declaram nada mais ter a reclamar uma da outra, em relação ao contrato ora rescindido, dando-se reciprocamente plena, geral, rasa e irrevogável quitação.</p>
<h3>Cláusula 2ª — Devolução</h3>
<p>O imóvel é devolvido nesta data, em perfeitas condições de uso e conservação, livre de pessoas e coisas.</p>
<h3>Cláusula 3ª — Vigência</h3>
<p>Este distrato passa a vigorar a partir desta data: {{contrato.data_fim}}.</p>
${ASSINATURAS}`,
  },
];