import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight, GraduationCap,
  BookOpen, Play, FileText, ExternalLink, Sparkles, Globe, EyeOff,
  FileDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { AppRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/elearning/admin")({
  component: ElearningAdmin,
});

// ─── Types ──────────────────────────────────────────────────────────────────

type Curso = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  imagem_capa_url: string | null;
  nivel: string;
  carga_horaria_min: number;
  status: string;
  ordem: number;
};

type Modulo = {
  id: string;
  curso_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
};

type Aula = {
  id: string;
  modulo_id: string;
  titulo: string;
  tipo: string;
  conteudo_html: string | null;
  video_url: string | null;
  arquivo_url: string | null;
  link_externo: string | null;
  duracao_min: number;
  ordem: number;
  gratuita: boolean;
};

// ─── Slug helper ─────────────────────────────────────────────────────────────

function slugify(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

// ─── Seed content ────────────────────────────────────────────────────────────

const SEED_CURSOS = [
  {
    titulo: "Jornada para se tornar corretor com CRECI",
    slug: "jornada-corretor-creci",
    descricao: "Do zero ao CRECI: entenda a profissão, os requisitos de habilitação, o processo de registro e os primeiros passos na carreira de corretor de imóveis no Brasil.",
    nivel: "iniciante",
    carga_horaria_min: 240,
    status: "published",
    ordem: 1,
    modulos: [
      {
        titulo: "Entendendo a Profissão",
        ordem: 1,
        aulas: [
          {
            titulo: "O que é o CRECI e por que ele é obrigatório",
            tipo: "texto",
            duracao_min: 10,
            conteudo_html: `<h2>O Conselho Regional de Corretores de Imóveis (CRECI)</h2>
<p>O CRECI é o órgão responsável por fiscalizar e regulamentar o exercício da profissão de corretor de imóveis no Brasil. Criado pela <strong>Lei nº 6.530/78</strong> e regulamentado pelo Decreto nº 81.871/78, o CRECI existe em cada estado e é supervisionado pelo COFECI (Conselho Federal de Corretores de Imóveis) em nível nacional.</p>
<h3>Por que o registro é obrigatório?</h3>
<ul>
  <li>Garante que o profissional possui formação técnica adequada</li>
  <li>Protege o comprador/locatário de fraudes e má conduta</li>
  <li>Assegura ao corretor o direito de cobrar honorários legalmente</li>
  <li>Exercer a profissão sem registro é contravenção penal (art. 20 da Lei 6.530/78)</li>
</ul>
<h3>O que o CRECI fiscaliza?</h3>
<p>O CRECI tem poder de fiscalizar obras, imobiliárias e profissionais que exercem atividades imobiliárias, autuar irregularidades e encaminhar representações ao Ministério Público.</p>
<blockquote>Dica: verifique sempre se o corretor com quem você está negociando possui registro ativo consultando o site do CRECI do seu estado.</blockquote>`,
          },
          {
            titulo: "Perfil e atribuições do corretor de imóveis",
            tipo: "texto",
            duracao_min: 12,
            conteudo_html: `<h2>O que faz o corretor de imóveis?</h2>
<p>O corretor de imóveis é o intermediário legal entre compradores, vendedores, locatários e locadores de imóveis. Suas atribuições incluem:</p>
<ul>
  <li><strong>Captação</strong>: identificar e angariar imóveis para o portfólio</li>
  <li><strong>Avaliação</strong>: estimar o valor de mercado de propriedades</li>
  <li><strong>Divulgação</strong>: anunciar em portais, redes sociais e outros canais</li>
  <li><strong>Atendimento</strong>: qualificar clientes e conduzir visitas</li>
  <li><strong>Negociação</strong>: intermediar propostas entre as partes</li>
  <li><strong>Documentação</strong>: acompanhar contratos, escrituras e registros</li>
</ul>
<h3>Campos de atuação</h3>
<ul>
  <li>Compra e venda de imóveis residenciais e comerciais</li>
  <li>Locação e administração de aluguéis</li>
  <li>Lançamentos imobiliários (plantão de vendas)</li>
  <li>Avaliação mercadológica (PTAM)</li>
  <li>Consultoria de investimentos imobiliários</li>
  <li>Gestão de fundos imobiliários (com formação complementar)</li>
</ul>
<h3>Habilidades essenciais</h3>
<p>Comunicação clara, escuta ativa, organização, conhecimento de mercado local, domínio básico de tecnologia (CRM, portais, WhatsApp Business) e ética profissional são fundamentais.</p>`,
          },
          {
            titulo: "O mercado imobiliário brasileiro",
            tipo: "texto",
            duracao_min: 15,
            conteudo_html: `<h2>Panorama do Mercado Imobiliário Brasileiro</h2>
<p>O setor imobiliário representa cerca de <strong>13% do PIB brasileiro</strong> e emprega milhões de profissionais diretos e indiretos. Entender o mercado é fundamental para qualquer corretor.</p>
<h3>Principais segmentos</h3>
<ul>
  <li><strong>Residencial Popular</strong>: programas habitacionais (Minha Casa Minha Vida), alta demanda, margens menores</li>
  <li><strong>Residencial Médio e Alto Padrão</strong>: maior valor por transação, ciclo de venda mais longo</li>
  <li><strong>Comercial</strong>: salas, lojas, galpões logísticos, mercado corporativo</li>
  <li><strong>Rural</strong>: fazendas, sítios, chácaras — exige habilitação específica no CRECI</li>
  <li><strong>Lançamentos</strong>: plantas, incorporadoras, pré-venda</li>
</ul>
<h3>Fatores que afetam o mercado</h3>
<ul>
  <li><strong>Taxa Selic</strong>: influencia diretamente as taxas de financiamento imobiliário</li>
  <li><strong>IGPM/IPCA</strong>: índices de correção de aluguéis</li>
  <li><strong>FGTS</strong>: principal fonte de recursos para o SFH (Sistema Financeiro da Habitação)</li>
  <li><strong>Urbanização</strong>: crescimento de cidades médias e interiores</li>
  <li><strong>Trabalho remoto</strong>: valorização de imóveis fora dos grandes centros</li>
</ul>
<h3>Ciclos do mercado</h3>
<p>O mercado imobiliário é cíclico: expansão → superaquecimento → retração → recuperação. Corretores bem preparados identificam oportunidades em cada fase do ciclo.</p>`,
          },
        ],
      },
      {
        titulo: "Formação e Habilitação",
        ordem: 2,
        aulas: [
          {
            titulo: "Curso técnico TTI: requisito para o CRECI",
            tipo: "texto",
            duracao_min: 18,
            conteudo_html: `<h2>Técnico em Transações Imobiliárias (TTI)</h2>
<p>O TTI é o curso de nível técnico exigido para obtenção do CRECI. É regulamentado pelo MEC e ministrado por instituições credenciadas em todo o Brasil.</p>
<h3>Grade curricular típica</h3>
<ul>
  <li>Direito imobiliário e legislação</li>
  <li>Matemática financeira e avaliação de imóveis</li>
  <li>Técnicas de vendas e marketing imobiliário</li>
  <li>Ética profissional e Código de Conduta COFECI</li>
  <li>Documentação e cartórios</li>
  <li>Financiamento imobiliário (SFH, SFI, FGTS)</li>
  <li>Estágio supervisionado</li>
</ul>
<h3>Duração e modalidades</h3>
<p>A carga mínima é de <strong>800 horas</strong>. Muitas escolas oferecem cursos de 6 a 12 meses, presenciais ou EAD (desde que o estágio seja presencial).</p>
<h3>Alternativa: Graduação em Ciências Imobiliárias</h3>
<p>Bacharéis em Ciências Imobiliárias (4 anos) também estão habilitados para o registro no CRECI, dispensando o TTI.</p>
<blockquote>Antes de escolher a escola, verifique se ela é reconhecida pelo MEC e se o CRECI do seu estado aceita o certificado emitido.</blockquote>`,
          },
          {
            titulo: "Processo de registro no CRECI: passo a passo",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Como solicitar o CRECI</h2>
<p>O processo varia ligeiramente entre estados, mas segue um fluxo padronizado:</p>
<h3>1. CRECI Provisório (estagiário)</h3>
<p>Durante o curso TTI, o aluno pode solicitar o registro provisório, que permite estagiar em imobiliárias sob supervisão de um profissional registrado.</p>
<h3>2. Documentação necessária (CRECI definitivo)</h3>
<ul>
  <li>Certificado do curso TTI ou diploma de graduação reconhecido</li>
  <li>RG e CPF originais</li>
  <li>Comprovante de residência</li>
  <li>2 fotos 3x4</li>
  <li>Certidão negativa criminal</li>
  <li>Pagamento da taxa de registro e primeira anuidade</li>
</ul>
<h3>3. Análise e deferimento</h3>
<p>O CRECI analisa a documentação em até 30 dias. Após deferimento, a carteira profissional é emitida.</p>
<h3>4. Manutenção do registro</h3>
<ul>
  <li>Pagar anuidade anualmente (valores variam por estado)</li>
  <li>Comunicar mudanças de endereço e dados cadastrais</li>
  <li>Cumprir o Código de Ética COFECI</li>
</ul>
<h3>5. Pessoa Jurídica</h3>
<p>Imobiliárias e empresas do ramo também precisam de registro no CRECI-J (Jurídico), além dos corretores individuais.</p>`,
          },
          {
            titulo: "Ética e Código de Ética COFECI",
            tipo: "texto",
            duracao_min: 15,
            conteudo_html: `<h2>O Código de Ética dos Corretores de Imóveis</h2>
<p>Aprovado pela Resolução COFECI nº 326/92, o Código de Ética estabelece as normas de conduta que todo corretor deve seguir.</p>
<h3>Princípios fundamentais</h3>
<ul>
  <li><strong>Honestidade</strong>: não omitir informações relevantes ao cliente</li>
  <li><strong>Lealdade</strong>: representar os interesses do cliente com fidelidade</li>
  <li><strong>Competência</strong>: atuar apenas nas áreas em que possui conhecimento</li>
  <li><strong>Confidencialidade</strong>: manter sigilo sobre informações do cliente</li>
</ul>
<h3>Vedações importantes</h3>
<ul>
  <li>Exercer a profissão sem estar devidamente registrado</li>
  <li>Receber comissão de ambas as partes sem conhecimento e concordância de ambas</li>
  <li>Induzir o cliente a celebrar negócio em prejuízo próprio</li>
  <li>Promover publicidade enganosa ou exagerada</li>
  <li>Usar meios ilícitos para obter vantagem</li>
</ul>
<h3>Consequências de infrações</h3>
<p>O CRECI pode aplicar: advertência verbal, censura escrita, multa, suspensão temporária ou cancelamento do registro. Infrações graves podem ser encaminhadas ao MP.</p>
<blockquote>Lembre-se: sua reputação é seu maior ativo. Um corretor ético constrói uma carteira de clientes fiel e recorrente ao longo de anos.</blockquote>`,
          },
        ],
      },
      {
        titulo: "Regulamentação e Honorários",
        ordem: 3,
        aulas: [
          {
            titulo: "Lei 6.530/78 e os direitos do corretor",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>A Lei que rege a profissão</h2>
<p>A Lei nº 6.530, de 12 de maio de 1978, é a principal norma que regula a profissão de corretor de imóveis no Brasil. Seu regulamento está no Decreto nº 81.871/78.</p>
<h3>Pontos-chave da Lei 6.530/78</h3>
<ul>
  <li><strong>Art. 2°</strong>: define o corretor como intermediário nas transações imobiliárias</li>
  <li><strong>Art. 6°</strong>: estabelece o CRECI como órgão de fiscalização</li>
  <li><strong>Art. 17°</strong>: garante ao corretor o direito aos honorários quando mediação resulta em negócio</li>
  <li><strong>Art. 20°</strong>: define como contravenção o exercício sem registro</li>
</ul>
<h3>Direito aos honorários</h3>
<p>Conforme a <strong>Súmula 335 do STJ</strong>, o corretor tem direito à comissão mesmo que o negócio não seja concluído por desistência das partes, desde que tenha conseguido um comprador/locatário que aceitou todas as condições propostas pelo vendedor/locador.</p>
<h3>Exclusividade e não-exclusividade</h3>
<p>A captação pode ser exclusiva (apenas uma imobiliária anuncia) ou não-exclusiva (várias). O contrato de captação deve especificar claramente o regime adotado e as regras de comissionamento.</p>`,
          },
          {
            titulo: "Tabela de honorários e comissões",
            tipo: "texto",
            duracao_min: 12,
            conteudo_html: `<h2>Honorários do Corretor de Imóveis</h2>
<p>Os honorários são estabelecidos pelas tabelas de cada CRECI estadual. As porcentagens abaixo são as mais praticadas no mercado (referência: CRECI-SP e COFECI):</p>
<h3>Compra e Venda</h3>
<ul>
  <li><strong>Imóveis urbanos</strong>: 6% a 8% sobre o valor da venda</li>
  <li><strong>Imóveis rurais</strong>: 8% a 10%</li>
  <li><strong>Loteamentos e incorporações</strong>: 4% a 6%</li>
  <li><strong>Vendas judiciais</strong>: 5%</li>
</ul>
<h3>Locação</h3>
<ul>
  <li>Honorários de locação: equivalente a 1 mês de aluguel (cobrado na assinatura)</li>
  <li>Administração mensal: 8% a 12% sobre o valor do aluguel</li>
</ul>
<h3>Divisão de comissão entre corretores</h3>
<p>Quando há captador e angariador (correto que fecha o negócio) diferentes:</p>
<ul>
  <li>Captador: 30% a 50% da comissão total</li>
  <li>Angariador: 50% a 70% da comissão total</li>
  <li>A divisão deve ser acordada previamente, preferencialmente por escrito</li>
</ul>
<blockquote>Importante: não existe tabela única nacional. Consulte sempre a tabela de honorários do CRECI do seu estado, pois ela é a referência legal vigente na sua região.</blockquote>`,
          },
        ],
      },
    ],
  },

  {
    titulo: "Como captar imóveis",
    slug: "como-captar-imoveis",
    descricao: "Técnicas comprovadas para aumentar seu portfólio: abordagem de proprietários, negociação de exclusividade, avaliação de imóveis e documentação de captação.",
    nivel: "intermediario",
    carga_horaria_min: 180,
    status: "published",
    ordem: 2,
    modulos: [
      {
        titulo: "Fundamentos da Captação",
        ordem: 1,
        aulas: [
          {
            titulo: "O que é captação e por que ela é vital",
            tipo: "texto",
            duracao_min: 12,
            conteudo_html: `<h2>Captação: o coração do negócio imobiliário</h2>
<p>Captação é o processo de identificar e obter autorização de proprietários para intermediar a venda ou locação de seus imóveis. Sem captação, não há portfólio; sem portfólio, não há negócios.</p>
<h3>Por que a captação é prioritária?</h3>
<ul>
  <li>Imóvel bem captado (preço justo + exclusividade) vende 3x mais rápido</li>
  <li>Portfólio amplo e diversificado atrai mais clientes compradores</li>
  <li>Captação gera receita recorrente (especialmente na locação)</li>
  <li>Proprietários satisfeitos indicam outros proprietários</li>
</ul>
<h3>Captação ativa vs. passiva</h3>
<table>
  <tr><th>Ativa</th><th>Passiva</th></tr>
  <tr><td>Você vai ao proprietário</td><td>O proprietário vem até você</td></tr>
  <tr><td>Indicações, prospecção de rua, mailing</td><td>Anúncios, redes sociais, site próprio</td></tr>
  <tr><td>Controle total do processo</td><td>Depende da visibilidade da marca</td></tr>
  <tr><td>Resultado imediato</td><td>Resultado de médio/longo prazo</td></tr>
</table>
<p>Corretores de alto desempenho combinam as duas estratégias, reservando parte da semana para prospecção ativa e mantendo presença digital constante para captação passiva.</p>`,
          },
          {
            titulo: "Mapeamento de oportunidades",
            tipo: "texto",
            duracao_min: 15,
            conteudo_html: `<h2>Onde encontrar imóveis para captar</h2>
<p>Antes de abordar proprietários, é essencial mapear onde estão as oportunidades na sua região de atuação.</p>
<h3>Fontes de leads de captação</h3>
<ul>
  <li><strong>Portais de anúncio próprio</strong>: OLX, VivaReal, ZAP (proprietários anunciando por conta)</li>
  <li><strong>Grupos de WhatsApp/Facebook</strong>: "Compro e Vendo [bairro]"</li>
  <li><strong>Placa de vende-se/aluga-se</strong>: andando pelo bairro de atuação</li>
  <li><strong>Indicações</strong>: carteira de clientes, amigos, família</li>
  <li><strong>Inventários e espólios</strong>: cartório de registros, advogados de família</li>
  <li><strong>Construtoras e incorporadoras</strong>: pós-obra e estoque</li>
  <li><strong>Síndicos de condomínio</strong>: conhecem proprietários com intenção de vender</li>
  <li><strong>Redes sociais</strong>: buscas por hashtags, grupos de bairro</li>
</ul>
<h3>Organizando a prospecção</h3>
<p>Use um CRM (como o imob365) para registrar todos os leads de captação com:</p>
<ul>
  <li>Endereço e tipo do imóvel</li>
  <li>Dados do proprietário (nome, telefone, e-mail)</li>
  <li>Fonte do lead</li>
  <li>Status da negociação (primeiro contato, proposta enviada, captado, perdido)</li>
  <li>Data do próximo follow-up</li>
</ul>`,
          },
        ],
      },
      {
        titulo: "Abordagem e Negociação",
        ordem: 2,
        aulas: [
          {
            titulo: "Script de abordagem ao proprietário",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Como abordar proprietários com sucesso</h2>
<p>A primeira impressão é determinante. O proprietário precisa sentir que você é o profissional certo para cuidar do bem mais valioso que ele possui.</p>
<h3>Estrutura do primeiro contato (telefone/WhatsApp)</h3>
<ol>
  <li><strong>Identificação</strong>: "Bom dia, [nome]! Meu nome é [seu nome], sou corretor de imóveis da [imobiliária], registro CRECI nº [xxx]."</li>
  <li><strong>Contexto</strong>: "Vi que seu imóvel na [rua/bairro] está disponível para venda/locação."</li>
  <li><strong>Proposta de valor</strong>: "Tenho clientes ativos buscando imóveis com essas características na região."</li>
  <li><strong>Solicitação</strong>: "Posso visitá-lo nesta semana para conhecer o imóvel e apresentar nossa proposta de divulgação?"</li>
</ol>
<h3>No encontro presencial</h3>
<ul>
  <li>Chegue pontualmente e bem apresentado</li>
  <li>Faça perguntas antes de falar: "Me conte um pouco sobre o imóvel..."</li>
  <li>Demonstre conhecimento da região (valores, infraestrutura, tendências)</li>
  <li>Apresente cases de sucesso anteriores (imóveis semelhantes vendidos)</li>
  <li>Não prometa o que não pode cumprir (prazo, preço irreal)</li>
</ul>
<h3>Objeções comuns e como responder</h3>
<ul>
  <li><strong>"Já tenho corretores"</strong>: "Compreendo. Nossa exclusividade garante dedicação total — posso mostrar como funciona?"</li>
  <li><strong>"Sua comissão é alta"</strong>: "Nossa comissão está na tabela CRECI e cobre toda a operação. Vou te mostrar o que está incluído."</li>
  <li><strong>"Vou vender por conta"</strong>: "Ótimo! Mas se quiser agilidade e segurança jurídica, pode contar com a gente em paralelo."</li>
</ul>`,
          },
          {
            titulo: "Negociação de exclusividade",
            tipo: "texto",
            duracao_min: 18,
            conteudo_html: `<h2>Por que buscar exclusividade?</h2>
<p>A exclusividade garante que apenas você (ou sua imobiliária) pode intermediar o imóvel por um período determinado. Isso permite:</p>
<ul>
  <li>Investir em marketing de qualidade (fotos profissionais, vídeos, tours 360°)</li>
  <li>Controlar o preço e evitar o "leilão" entre corretores</li>
  <li>Dedicar tempo de qualidade para o imóvel</li>
  <li>Proteger seu investimento de tempo e recursos</li>
</ul>
<h3>Como convencer o proprietário</h3>
<ol>
  <li><strong>Apresente o plano de marketing</strong>: mostre exatamente o que você vai fazer (portais, redes sociais, email marketing, open house)</li>
  <li><strong>Estabeleça metas claras</strong>: "Nos primeiros 30 dias faremos X visitas e Y contatos ativos"</li>
  <li><strong>Proponha prazo razoável</strong>: 90 a 120 dias para imóveis residenciais; 60 dias para locação</li>
  <li><strong>Cláusula de rescisão</strong>: ofereça saída antecipada se não cumprir as metas</li>
</ol>
<h3>Tipos de autorização</h3>
<ul>
  <li><strong>Exclusiva</strong>: apenas uma imobiliária/corretor. Comissão garantida mesmo que o comprador apareça por outro canal.</li>
  <li><strong>Não-exclusiva (open listing)</strong>: várias imobiliárias. Recebe comissão apenas quem fechar. Risco: desincentiva investimento em marketing.</li>
  <li><strong>Semi-exclusiva</strong>: exclusiva para imobiliárias, mas o proprietário pode vender diretamente sem pagar comissão.</li>
</ul>`,
          },
          {
            titulo: "Avaliação e precificação do imóvel",
            tipo: "texto",
            duracao_min: 25,
            conteudo_html: `<h2>Avaliação Mercadológica de Imóveis</h2>
<p>A precificação correta é crítica: imóvel superavaliado não vende; imóvel subavaliado prejudica o proprietário (e a reputação do corretor).</p>
<h3>Método Comparativo Direto</h3>
<p>O método mais usado no mercado residencial. Compare o imóvel em análise com 3 a 5 imóveis semelhantes (mesma região, tipo, área e padrão construtivo) que foram vendidos recentemente ou estão à venda.</p>
<h3>Fatores de valorização/desvalorização</h3>
<ul>
  <li>Localização (bairro, proximidade de serviços, acessos)</li>
  <li>Andar (em prédios, andares altos valorizam — exceto cobertura vs. próximo à rua)</li>
  <li>Posição solar (apartamentos ensolarados valem mais)</li>
  <li>Conservação e acabamento</li>
  <li>Vagas de garagem</li>
  <li>Lazer do condomínio</li>
  <li>Vista (mar, parque, área verde)</li>
</ul>
<h3>PTAM — Parecer Técnico de Avaliação Mercadológica</h3>
<p>Para avaliações formais (inventários, financiamentos, seguros), é possível emitir um PTAM — documento técnico que formaliza a avaliação. A elaboração de PTAMs é uma atribuição exclusiva do corretor de imóveis registrado no CRECI.</p>
<h3>Dica prática</h3>
<blockquote>Nunca concorde com o preço pedido pelo proprietário sem análise. Diga: "Deixa eu fazer uma pesquisa de mercado e te apresento um número embasado em dados reais." Um preço correto gera venda; um preço irreal gera estresse.</blockquote>`,
          },
        ],
      },
      {
        titulo: "Documentação e Contrato",
        ordem: 3,
        aulas: [
          {
            titulo: "Autorização de venda: cláusulas essenciais",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Contrato de Autorização de Venda (Captação)</h2>
<p>A autorização de venda é o contrato que formaliza a captação do imóvel. Ela protege tanto o proprietário quanto o corretor.</p>
<h3>Cláusulas obrigatórias</h3>
<ul>
  <li><strong>Identificação das partes</strong>: proprietário(s) e imobiliária/corretor (com CRECI)</li>
  <li><strong>Descrição do imóvel</strong>: endereço, matrícula, características principais</li>
  <li><strong>Valor de venda autorizado</strong>: preço mínimo e/ou preço pedido</li>
  <li><strong>Prazo de vigência</strong>: data de início e término</li>
  <li><strong>Percentual de honorários</strong>: conforme tabela CRECI do estado</li>
  <li><strong>Regime</strong>: exclusiva ou não-exclusiva</li>
  <li><strong>Obrigações do corretor</strong>: o que ele se compromete a fazer</li>
  <li><strong>Foro</strong>: comarca competente para eventuais litígios</li>
</ul>
<h3>Sobre a comissão em caso de venda direta</h3>
<p>Em contratos de exclusividade, o proprietário deve pagar comissão mesmo que venda diretamente para um cliente que ele mesmo encontrou durante a vigência do contrato. Deixe isso claro e por escrito.</p>
<h3>Documentação do imóvel que você deve solicitar</h3>
<ul>
  <li>Certidão de matrícula atualizada (máximo 30 dias)</li>
  <li>IPTU do ano corrente</li>
  <li>Documentos dos proprietários (RG, CPF, certidão de casamento se casados)</li>
  <li>Declaração de inexistência de débitos condominiais</li>
  <li>Habite-se (para imóveis mais antigos)</li>
</ul>`,
          },
        ],
      },
    ],
  },

  {
    titulo: "Dicas sobre administração imobiliária",
    slug: "administracao-imobiliaria",
    descricao: "Gestão do negócio, marketing digital, atendimento ao cliente e administração de locações: um guia completo para corretores autônomos e pequenas imobiliárias.",
    nivel: "intermediario",
    carga_horaria_min: 200,
    status: "published",
    ordem: 3,
    modulos: [
      {
        titulo: "Gestão do Negócio",
        ordem: 1,
        aulas: [
          {
            titulo: "Estrutura de uma imobiliária eficiente",
            tipo: "texto",
            duracao_min: 18,
            conteudo_html: `<h2>Estruturando seu negócio imobiliário</h2>
<p>Uma imobiliária eficiente não precisa ser grande — precisa ser bem organizada. Veja os pilares de uma operação saudável:</p>
<h3>Formalização</h3>
<ul>
  <li>Abra um CNPJ (MEI permite faturamento até R$ 81 mil/ano; acima disso, Simples Nacional como ME)</li>
  <li>Registre a empresa no CRECI-J</li>
  <li>Tenha contrato social claro sobre divisão de cotas e responsabilidades</li>
</ul>
<h3>Ferramentas essenciais</h3>
<ul>
  <li><strong>CRM imobiliário</strong>: organize leads, imóveis e pipeline de vendas</li>
  <li><strong>Portais de anúncio</strong>: VivaReal, ZAP Imóveis, OLX</li>
  <li><strong>Google Workspace ou similar</strong>: e-mail profissional, agenda, documentos</li>
  <li><strong>WhatsApp Business</strong>: catálogo de imóveis, respostas automáticas</li>
  <li><strong>Sistema de gestão financeira</strong>: controle de comissões a receber</li>
</ul>
<h3>Indicadores-chave (KPIs)</h3>
<ul>
  <li>Número de captações por mês</li>
  <li>Número de leads recebidos vs. qualificados</li>
  <li>Taxa de conversão lead → visita → proposta → venda</li>
  <li>Tempo médio de venda por imóvel</li>
  <li>Receita média por transação</li>
  <li>NPS (Net Promoter Score) dos clientes</li>
</ul>
<blockquote>Meça sempre. Um negócio sem números é um barco sem bússola. Revise seus KPIs mensalmente e ajuste a estratégia.</blockquote>`,
          },
          {
            titulo: "Gestão financeira básica para corretores",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Finanças para Corretores de Imóveis</h2>
<p>A renda de um corretor é variável. Aprender a gerenciar o fluxo de caixa é tão importante quanto captar e vender.</p>
<h3>Separação pessoa física / jurídica</h3>
<p>Nunca misture dinheiro pessoal com o da empresa. Abra uma conta corrente PJ e transfira um "pró-labore" fixo para sua conta pessoal — mesmo nos meses de receita alta.</p>
<h3>Reserva de emergência profissional</h3>
<p>O mercado imobiliário tem sazonalidade (recesso de fim de ano, eleições, crises). Mantenha uma reserva de 3 a 6 meses de custos fixos.</p>
<h3>Precificação do seu serviço</h3>
<ul>
  <li>Calcule seu custo mensal total (moradia, alimentação, transporte, plano de saúde, ferramentas, marketing)</li>
  <li>Defina sua meta de renda líquida</li>
  <li>Calcule quantas transações por mês você precisa fechar</li>
  <li>Trabalhe para atingir essa meta com margem de segurança</li>
</ul>
<h3>Impostos</h3>
<ul>
  <li><strong>MEI</strong>: DAS unificado (fixo mensal, ~R$ 70/mês em 2025)</li>
  <li><strong>Simples Nacional</strong>: alíquota entre 6% e 15,5% dependendo da receita</li>
  <li><strong>Pessoa Física</strong>: carnê-leão obrigatório para rendimentos acima de R$ 2.824/mês (2025)</li>
</ul>
<h3>Controle de comissões a receber</h3>
<p>Registre cada comissão com: data de assinatura do contrato, valor esperado, data prevista de recebimento, e status. Mude o status para "recebido" ao liquidar. Isso evita surpresas no fluxo de caixa.</p>`,
          },
        ],
      },
      {
        titulo: "Marketing Imobiliário",
        ordem: 2,
        aulas: [
          {
            titulo: "Fotografia e apresentação de imóveis",
            tipo: "texto",
            duracao_min: 18,
            conteudo_html: `<h2>A foto que vende o imóvel</h2>
<p>Estudos mostram que anúncios com fotos profissionais têm até <strong>3x mais contatos</strong> do que aqueles com fotos de celular. A foto é o primeiro produto que você vende.</p>
<h3>Equipamentos mínimos necessários</h3>
<ul>
  <li>Câmera com lente grande angular (18-35mm) — ou smartphone de alta resolução</li>
  <li>Tripé</li>
  <li>Flash externo ou softbox para ambientes escuros</li>
</ul>
<h3>Preparando o imóvel para fotos</h3>
<ul>
  <li>Imóvel limpo e organizado — retire objetos pessoais, roupas, sapatos</li>
  <li>Fotografe no período de maior incidência de luz natural</li>
  <li>Abra todas as janelas e cortinas</li>
  <li>Ligue todos os pontos de luz</li>
  <li>Faça pequenos reparos visíveis (torneira pingando, pintura descascada)</li>
</ul>
<h3>Composição das fotos</h3>
<ul>
  <li>Fotografe dos cantos do ambiente (maximiza profundidade)</li>
  <li>Mantenha a câmera nivelada (nunca inclinada para cima ou baixo)</li>
  <li>Inclua sempre: fachada, sala, cozinha, todos os quartos, banheiros, área de serviço, garagem</li>
  <li>Foto aérea (drone) valoriza terrenos e imóveis com área externa</li>
</ul>
<h3>Tour virtual e vídeo</h3>
<p>Imóveis com tour 360° têm 87% mais interesse segundo pesquisas de portais. Ferramentas gratuitas/acessíveis: Matterport Lite, Cupix, ou simplesmente um vídeo percorrendo todos os cômodos.</p>`,
          },
          {
            titulo: "Anúncios em portais: boas práticas",
            tipo: "texto",
            duracao_min: 15,
            conteudo_html: `<h2>Anunciando nos principais portais</h2>
<p>VivaReal, ZAP Imóveis e OLX são os portais com maior tráfego imobiliário no Brasil. Saiba como maximizar sua visibilidade.</p>
<h3>Título do anúncio</h3>
<p>Use o formato: <code>[Tipo] [Metragem] [Bairro] [Diferencial] — [Cidade]</code></p>
<p>Exemplo: "Apartamento 90m² Boqueirão 3 dorms 2 vagas — Praia Grande/SP"</p>
<h3>Descrição eficiente</h3>
<ul>
  <li>Comece pelos pontos mais fortes do imóvel</li>
  <li>Inclua: área útil, número de cômodos, vagas, lazer do condomínio, infraestrutura do bairro</li>
  <li>Mencione diferenciais: vista, reformado, mobiliado, aceita FGTS</li>
  <li>Finalize com chamada para ação: "Agende sua visita!" ou "Consulte condições de financiamento"</li>
</ul>
<h3>Preço</h3>
<ul>
  <li>Preço fora de mercado → poucas visualizações</li>
  <li>Preço competitivo → mais leads qualificados</li>
  <li>Não oculte o preço — anúncios sem preço têm taxa de clique menor</li>
</ul>
<h3>Posicionamento</h3>
<p>Os portais oferecem planos pagos de destaque. Avalie o custo-benefício: imóveis de ticket alto justificam investimento maior em destaque.</p>
<h3>Frequência de atualização</h3>
<p>Atualize os anúncios semanalmente. Anúncios mais recentes aparecem primeiro nas buscas orgânicas.</p>`,
          },
          {
            titulo: "Marketing digital e redes sociais para corretores",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Presença digital do corretor de imóveis</h2>
<p>Em 2025, um corretor sem presença digital é invisível para a maioria dos clientes. Mas não é preciso estar em todos os lugares — seja consistente nos canais certos.</p>
<h3>Instagram</h3>
<ul>
  <li>Publique imóveis com fotos profissionais e Stories diários</li>
  <li>Alterne conteúdo: imóveis (40%) + dicas de mercado (30%) + bastidores/pessoal (30%)</li>
  <li>Use Reels para aumentar alcance orgânico</li>
  <li>Hashtags locais: #imóveissp #vemdemorar[bairro]</li>
</ul>
<h3>WhatsApp Business</h3>
<ul>
  <li>Configure catálogo com seus imóveis principais</li>
  <li>Crie listas de transmissão segmentadas (compradores × locatários × investidores)</li>
  <li>Responda em até 2 horas — velocidade é diferencial competitivo</li>
  <li>Status: publique imóveis e novidades diariamente</li>
</ul>
<h3>Google Meu Negócio</h3>
<p>Cadastre sua imobiliária no Google Meu Negócio gratuitamente. Isso faz você aparecer nas buscas locais: "corretor de imóveis [cidade]".</p>
<h3>LinkedIn</h3>
<p>Essencial para mercado corporativo e investidores. Publique análises de mercado, tendências e cases de sucesso.</p>
<h3>Email marketing</h3>
<ul>
  <li>Construa uma lista de clientes e leads</li>
  <li>Envie newsletter mensal com: lançamentos, dicas de mercado, taxa de juros</li>
  <li>Ferramentas gratuitas para começar: Mailchimp, Brevo</li>
</ul>`,
          },
        ],
      },
      {
        titulo: "Atendimento e Fechamento",
        ordem: 3,
        aulas: [
          {
            titulo: "Qualificação de leads e perguntas-chave",
            tipo: "texto",
            duracao_min: 18,
            conteudo_html: `<h2>Qualificando leads: não desperdice seu tempo</h2>
<p>Nem todo lead é um comprador. Qualificar significa descobrir rapidamente quem tem real potencial de fechar negócio.</p>
<h3>As 5 perguntas essenciais de qualificação (BANT adaptado)</h3>
<ol>
  <li><strong>Budget (Orçamento)</strong>: "Qual é o valor que você tem disponível para investir?" ou "Você já consultou algum banco sobre financiamento?"</li>
  <li><strong>Authority (Autoridade)</strong>: "A decisão de compra é sua ou você precisa consultar alguém?" (cônjuge, sócios, pais)</li>
  <li><strong>Need (Necessidade)</strong>: "O que motivou você a buscar um imóvel agora?" — urgência real ou curiosidade?</li>
  <li><strong>Timeline (Prazo)</strong>: "Qual é o prazo ideal para você se mudar/investir?"</li>
  <li><strong>Profile (Perfil)</strong>: "Quantas pessoas vão morar? Qual bairro? Quantos quartos mínimos?"</li>
</ol>
<h3>Sinais de lead quente</h3>
<ul>
  <li>Sabe exatamente o que quer</li>
  <li>Tem prazo definido</li>
  <li>Já tem pré-aprovação de crédito ou capital disponível</li>
  <li>Faz perguntas detalhadas sobre o imóvel específico</li>
  <li>Propõe horários de visita</li>
</ul>
<h3>Sinais de lead frio</h3>
<ul>
  <li>Respostas vagas sobre orçamento</li>
  <li>"Estou só olhando"</li>
  <li>Não tem prazo definido</li>
  <li>Não tem decisão de compra autônoma</li>
</ul>
<p>Leads frios merecem nutrição (e-mail, WhatsApp periódico) mas não devem consumir tempo de visitas e apresentações imediatas.</p>`,
          },
          {
            titulo: "Técnicas de visita e follow-up",
            tipo: "texto",
            duracao_min: 20,
            conteudo_html: `<h2>Conduzindo visitas de alto impacto</h2>
<h3>Antes da visita</h3>
<ul>
  <li>Conheça o imóvel com antecedência — nunca visite com o cliente sem antes ter visto o imóvel</li>
  <li>Prepare respostas para perguntas comuns: condomínio, IPTU, vizinhança, histórico</li>
  <li>Confirme a visita 1 hora antes via WhatsApp</li>
</ul>
<h3>Durante a visita</h3>
<ul>
  <li>Chegue 10 minutos antes para preparar o imóvel (luzes acesas, arejar ambientes)</li>
  <li>Ouça mais do que fale — pergunte o que o cliente acha de cada cômodo</li>
  <li>Destaque os pontos fortes; não omita problemas relevantes (isso protege você)</li>
  <li>Observe as reações não-verbais (entusiasmo, hesitação)</li>
  <li>Ao final: "O que você gostou mais? Algo que te preocupou?"</li>
</ul>
<h3>Proposta imediata vs. follow-up</h3>
<p>Se o cliente demonstrou interesse claro: "Posso preparar uma proposta hoje?" Não deixe o entusiasmo esfriar.</p>
<p>Se precisar pensar: agende o retorno imediatamente — "Quando você volta a ter uma janela?" — e anote na agenda.</p>
<h3>Follow-up eficiente</h3>
<ul>
  <li><strong>Dia 1 (mesmo dia)</strong>: "Oi [nome], foi uma satisfação mostrar o imóvel! O que ficou de dúvida?"</li>
  <li><strong>Dia 3</strong>: "Alguma novidade? Encontrei mais 2 opções que podem te interessar."</li>
  <li><strong>Semana 2</strong>: mensagem com conteúdo de valor (dicas de financiamento, mercado da região)</li>
  <li><strong>Mensalmente</strong>: para leads mais frios — apareça sem pressionar</li>
</ul>`,
          },
        ],
      },
      {
        titulo: "Gestão de Locações",
        ordem: 4,
        aulas: [
          {
            titulo: "Administração de aluguéis: do contrato ao repasse",
            tipo: "texto",
            duracao_min: 22,
            conteudo_html: `<h2>Administração de Locação: receita recorrente para a imobiliária</h2>
<p>Administrar aluguéis gera receita mensal previsível e fortalece o relacionamento com proprietários. É uma das atividades mais rentáveis a longo prazo.</p>
<h3>O processo de locação completo</h3>
<ol>
  <li><strong>Captação do imóvel</strong>: autorização de locação com proprietário</li>
  <li><strong>Anúncio e divulgação</strong>: portais, redes sociais, vitrine</li>
  <li><strong>Recebimento de pretendentes</strong>: qualificação e visitas</li>
  <li><strong>Análise de crédito</strong>: SPC/Serasa, comprovante de renda (mínimo 3x o aluguel), referências</li>
  <li><strong>Garantia locatícia</strong>: escolha entre caução (3 meses), fiança (fiador), seguro fiança ou título de capitalização</li>
  <li><strong>Assinatura do contrato</strong>: prazo, índice de correção (IGPM ou IPCA), cláusulas especiais</li>
  <li><strong>Vistoria de entrada</strong>: laudo detalhado com fotos — fundamental para comparar na saída</li>
  <li><strong>Repasse mensal</strong>: receber do locatário → descontar taxa de administração → repassar ao proprietário</li>
</ol>
<h3>Taxa de administração</h3>
<p>Geralmente de 8% a 12% sobre o valor do aluguel. Inclui: cobrança, repasse, gestão de sinistros e intermediação com locatário.</p>
<h3>Inadimplência</h3>
<ul>
  <li>Acionar o seguro fiança ou fiador imediatamente após 30 dias de atraso</li>
  <li>Enviar notificação formal por escrito (e-mail com AR ou Whatsapp com confirmação)</li>
  <li>Ação de despejo: prazo legal de 15 a 30 dias após notificação (Lei do Inquilinato — Lei 8.245/91)</li>
</ul>
<h3>Reajuste anual</h3>
<p>O contrato deve prever o índice de reajuste. O IGPM é o índice tradicional; nos últimos anos, o IPCA ganhou espaço por ser mais estável. O reajuste é aplicado anualmente na data aniversário do contrato.</p>`,
          },
        ],
      },
    ],
  },
];

// ─── Admin Component ──────────────────────────────────────────────────────────

type View = "cursos" | "modulos" | "aulas";

type CursoForm = {
  titulo: string; slug: string; descricao: string; imagem_capa_url: string;
  nivel: string; carga_horaria_min: number; status: string; ordem: number;
};

type ModuloForm = { titulo: string; descricao: string; ordem: number };

type AulaForm = {
  titulo: string; tipo: string; conteudo_html: string; video_url: string;
  arquivo_url: string; link_externo: string; duracao_min: number; ordem: number; gratuita: boolean;
};

const EMPTY_CURSO: CursoForm = { titulo: "", slug: "", descricao: "", imagem_capa_url: "", nivel: "iniciante", carga_horaria_min: 0, status: "draft", ordem: 0 };
const EMPTY_MODULO: ModuloForm = { titulo: "", descricao: "", ordem: 0 };
const EMPTY_AULA: AulaForm = { titulo: "", tipo: "texto", conteudo_html: "", video_url: "", arquivo_url: "", link_externo: "", duracao_min: 5, ordem: 0, gratuita: false };

function ElearningAdmin() {
  const { isAdmin, roles, tenantId } = useAuth();
  const db = supabase as any;
  const { confirmDialog, ConfirmDialog } = useConfirm();

  const [view, setView] = useState<View>("cursos");
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [selectedModulo, setSelectedModulo] = useState<Modulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationError, setMigrationError] = useState(false);

  const autoSeedDone = useRef(false);

  // Modals
  const [cursoModal, setCursoModal] = useState(false);
  const [moduloModal, setModuloModal] = useState(false);
  const [aulaModal, setAulaModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cursoForm, setCursoForm] = useState<CursoForm>(EMPTY_CURSO);
  const [moduloForm, setModuloForm] = useState<ModuloForm>(EMPTY_MODULO);
  const [aulaForm, setAulaForm] = useState<AulaForm>(EMPTY_AULA);

  useEffect(() => { loadCursos(); }, []);

  // Auto-seed: popula com exemplos na primeira vez que o tenant não tem cursos
  useEffect(() => {
    if (!loading && tenantId && cursos.length === 0 && !migrationError && !autoSeedDone.current) {
      autoSeedDone.current = true;
      void seedCursosAuto(tenantId);
    }
  }, [loading, tenantId, cursos.length, migrationError]);

  async function loadCursos() {
    setLoading(true);
    const { data, error } = await db.from("elearning_cursos").select("*").order("ordem");
    if (error) {
      setMigrationError(true);
    } else {
      setMigrationError(false);
      setCursos(data ?? []);
    }
    setLoading(false);
  }

  async function loadModulos(cursoId: string) {
    const { data } = await db.from("elearning_modulos").select("*").eq("curso_id", cursoId).order("ordem");
    setModulos(data ?? []);
  }

  async function loadAulas(moduloId: string) {
    const { data } = await db.from("elearning_aulas").select("*").eq("modulo_id", moduloId).order("ordem");
    setAulas(data ?? []);
  }

  // ── Curso CRUD ──

  function openNewCurso() {
    setEditingId(null);
    setCursoForm(EMPTY_CURSO);
    setCursoModal(true);
  }

  function openEditCurso(c: Curso) {
    setEditingId(c.id);
    setCursoForm({ titulo: c.titulo, slug: c.slug, descricao: c.descricao ?? "", imagem_capa_url: c.imagem_capa_url ?? "", nivel: c.nivel, carga_horaria_min: c.carga_horaria_min, status: c.status, ordem: c.ordem });
    setCursoModal(true);
  }

  async function saveCurso() {
    if (!cursoForm.titulo) return toast.error("Título obrigatório");
    setSaving(true);
    const payload = { ...cursoForm, tenant_id: tenantId, slug: cursoForm.slug || slugify(cursoForm.titulo), updated_at: new Date().toISOString() };
    const { error } = editingId
      ? await db.from("elearning_cursos").update(payload).eq("id", editingId)
      : await db.from("elearning_cursos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Curso atualizado" : "Curso criado");
    setCursoModal(false);
    loadCursos();
  }

  async function deleteCurso(id: string) {
    if (!(await confirmDialog("Excluir este curso e todo seu conteúdo permanentemente?"))) return;
    const { error } = await db.from("elearning_cursos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedCurso?.id === id) { setSelectedCurso(null); setView("cursos"); }
    loadCursos();
  }

  // ── Modulo CRUD ──

  function openNewModulo() {
    setEditingId(null);
    setModuloForm({ ...EMPTY_MODULO, ordem: modulos.length });
    setModuloModal(true);
  }

  function openEditModulo(m: Modulo) {
    setEditingId(m.id);
    setModuloForm({ titulo: m.titulo, descricao: m.descricao ?? "", ordem: m.ordem });
    setModuloModal(true);
  }

  async function saveModulo() {
    if (!selectedCurso || !moduloForm.titulo) return toast.error("Título obrigatório");
    setSaving(true);
    const payload = { ...moduloForm, curso_id: selectedCurso.id, tenant_id: tenantId };
    const { error } = editingId
      ? await db.from("elearning_modulos").update(payload).eq("id", editingId)
      : await db.from("elearning_modulos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Módulo atualizado" : "Módulo criado");
    setModuloModal(false);
    loadModulos(selectedCurso.id);
  }

  async function deleteModulo(id: string) {
    if (!(await confirmDialog("Excluir este módulo e suas aulas?"))) return;
    const { error } = await db.from("elearning_modulos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedModulo?.id === id) { setSelectedModulo(null); setView("modulos"); }
    loadModulos(selectedCurso!.id);
  }

  // ── Aula CRUD ──

  function openNewAula() {
    setEditingId(null);
    setAulaForm({ ...EMPTY_AULA, ordem: aulas.length });
    setAulaModal(true);
  }

  function openEditAula(a: Aula) {
    setEditingId(a.id);
    setAulaForm({ titulo: a.titulo, tipo: a.tipo, conteudo_html: a.conteudo_html ?? "", video_url: a.video_url ?? "", arquivo_url: a.arquivo_url ?? "", link_externo: a.link_externo ?? "", duracao_min: a.duracao_min, ordem: a.ordem, gratuita: a.gratuita });
    setAulaModal(true);
  }

  async function saveAula() {
    if (!selectedModulo || !aulaForm.titulo) return toast.error("Título obrigatório");
    setSaving(true);
    const payload = {
      ...aulaForm,
      modulo_id: selectedModulo.id,
      tenant_id: tenantId,
      conteudo_html: aulaForm.conteudo_html || null,
      video_url: aulaForm.video_url || null,
      arquivo_url: aulaForm.arquivo_url || null,
      link_externo: aulaForm.link_externo || null,
    };
    const { error } = editingId
      ? await db.from("elearning_aulas").update(payload).eq("id", editingId)
      : await db.from("elearning_aulas").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Aula atualizada" : "Aula criada");
    setAulaModal(false);
    loadAulas(selectedModulo.id);
  }

  async function deleteAula(id: string) {
    if (!(await confirmDialog("Excluir esta aula?"))) return;
    await db.from("elearning_aulas").delete().eq("id", id);
    loadAulas(selectedModulo!.id);
  }

  // ── Seed ──

  async function seedCursosAuto(tid: string) {
    let inserted = 0;
    try {
      for (const curso of SEED_CURSOS) {
        const { modulos: mods, ...cursoData } = curso;
        const { data: c, error: ce } = await db.from("elearning_cursos")
          .upsert({ ...cursoData, tenant_id: tid, updated_at: new Date().toISOString() }, { onConflict: "slug,tenant_id" })
          .select("id").single();
        if (ce) {
          toast.error(`Erro ao criar curso "${curso.titulo}": ${ce.message}.`);
          return;
        }
        if (!c) continue;

        for (const mod of mods) {
          const { aulas: als, ...modData } = mod;
          const { data: m, error: me } = await db.from("elearning_modulos")
            .insert({ ...modData, curso_id: c.id, tenant_id: tid }).select("id").single();
          if (me || !m) continue;

          for (const aula of als) {
            await db.from("elearning_aulas").insert({
              ...aula,
              modulo_id: m.id,
              tenant_id: tid,
              conteudo_html: aula.conteudo_html ?? null,
              video_url: (aula as any).video_url ?? null,
              arquivo_url: (aula as any).arquivo_url ?? null,
              link_externo: (aula as any).link_externo ?? null,
            });
          }
        }
        inserted++;
      }
      toast.success(`${inserted} curso(s) inserido(s) com sucesso!`);
      loadCursos();
    } catch (e: any) {
      toast.error("Erro ao inserir cursos: " + e.message);
    }
  }

  // ── Navigation ──

  function selectCurso(c: Curso) {
    setSelectedCurso(c);
    loadModulos(c.id);
    setSelectedModulo(null);
    setView("modulos");
  }

  function selectModulo(m: Modulo) {
    setSelectedModulo(m);
    loadAulas(m.id);
    setView("aulas");
  }

  if (!isAdmin && !can(roles as any, "elearning", "write")) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <ConfirmDialog />

      {/* Migration warning */}
      {migrationError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive mb-1">Tabelas do E-Learning não encontradas no banco de dados.</p>
          <p className="text-muted-foreground mb-2">Execute a migração SQL no Supabase antes de usar este módulo:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground text-xs">
            <li>Acesse o painel do Supabase → SQL Editor</li>
            <li>Cole o conteúdo de <code className="bg-muted px-1 rounded">supabase/migrations/20260615000001_elearning_module.sql</code></li>
            <li>Execute e recarregue esta página</li>
          </ol>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Gerenciar E-Learning</h1>
          </div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => setView("cursos")} className={`hover:text-foreground ${view === "cursos" ? "text-primary font-semibold" : ""}`}>Cursos</button>
            {selectedCurso && (
              <>
                <ChevronRight className="h-3 w-3" />
                <button onClick={() => { setView("modulos"); setSelectedModulo(null); }} className={`hover:text-foreground truncate max-w-[150px] ${view === "modulos" ? "text-primary font-semibold" : ""}`}>{selectedCurso.titulo}</button>
              </>
            )}
            {selectedModulo && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className={`truncate max-w-[150px] ${view === "aulas" ? "text-primary font-semibold" : ""}`}>{selectedModulo.titulo}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {view === "cursos" && (
            <>
<Button size="sm" onClick={openNewCurso} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo curso
              </Button>
            </>
          )}
          {view === "modulos" && (
            <Button size="sm" onClick={openNewModulo} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo módulo
            </Button>
          )}
          {view === "aulas" && (
            <Button size="sm" onClick={openNewAula} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova aula
            </Button>
          )}
        </div>
      </div>

      {/* ── View: Cursos ── */}
      {view === "cursos" && (
        <div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse"/>)}</div>
          ) : cursos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-sm text-muted-foreground">Nenhum curso criado ainda. Carregando exemplos…</p>

            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Curso</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Nível</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Carga</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {cursos.map((c, i) => (
                    <tr key={c.id} className={`border-t border-border/60 hover:bg-muted/20 cursor-pointer ${i % 2 ? "bg-muted/10" : ""}`} onClick={() => selectCurso(c)}>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-xs">{c.titulo}</div>
                        <div className="text-[11px] text-muted-foreground">/{c.slug}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell capitalize text-muted-foreground text-xs">{c.nivel}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{c.carga_horaria_min > 0 ? `${c.carga_horaria_min}min` : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.status === "published" ? "default" : "secondary"} className={`text-[10px] ${c.status === "published" ? "bg-green-100 text-green-800 border-green-200" : ""}`}>
                          {c.status === "published" ? <><Globe className="h-2.5 w-2.5 mr-1"/>Publicado</> : <><EyeOff className="h-2.5 w-2.5 mr-1"/>Rascunho</>}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEditCurso(c)}><Pencil className="h-3.5 w-3.5"/></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteCurso(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── View: Módulos ── */}
      {view === "modulos" && selectedCurso && (
        <div className="space-y-3">
          {modulos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum módulo criado. Adicione módulos para organizar as aulas.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Módulo</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Ordem</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((m, i) => (
                    <tr key={m.id} className={`border-t border-border/60 hover:bg-muted/20 cursor-pointer ${i % 2 ? "bg-muted/10" : ""}`} onClick={() => selectModulo(m)}>
                      <td className="px-4 py-3 font-medium">{m.titulo}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{m.ordem}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEditModulo(m)}><Pencil className="h-3.5 w-3.5"/></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteModulo(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── View: Aulas ── */}
      {view === "aulas" && selectedModulo && (
        <div className="space-y-3">
          {aulas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhuma aula criada neste módulo.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Aula</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Duração</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((a, i) => {
                    const Icon = a.tipo === "video" ? Play : a.tipo === "pdf" ? FileDown : a.tipo === "link" ? ExternalLink : FileText;
                    return (
                      <tr key={a.id} className={`border-t border-border/60 ${i % 2 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 font-medium">{a.titulo}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3 w-3"/>{a.tipo}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{a.duracao_min}min</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEditAula(a)}><Pencil className="h-3.5 w-3.5"/></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteAula(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Curso ── */}
      <Dialog open={cursoModal} onOpenChange={setCursoModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar curso" : "Novo curso"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input value={cursoForm.titulo} onChange={e => setCursoForm(f => ({ ...f, titulo: e.target.value, slug: f.slug || slugify(e.target.value) }))} placeholder="Nome do curso" />
            </div>
            <div className="grid gap-1.5">
              <Label>Slug</Label>
              <Input value={cursoForm.slug} onChange={e => setCursoForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="url-do-curso" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descrição</Label>
              <Textarea value={cursoForm.descricao} onChange={e => setCursoForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
            </div>
            <div className="grid gap-1.5">
              <Label>URL da imagem de capa</Label>
              <Input value={cursoForm.imagem_capa_url} onChange={e => setCursoForm(f => ({ ...f, imagem_capa_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nível</Label>
                <Select value={cursoForm.nivel} onValueChange={v => setCursoForm(f => ({ ...f, nivel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">Iniciante</SelectItem>
                    <SelectItem value="intermediario">Intermediário</SelectItem>
                    <SelectItem value="avancado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Carga horária (min)</Label>
                <Input type="number" value={cursoForm.carga_horaria_min} onChange={e => setCursoForm(f => ({ ...f, carga_horaria_min: +e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={cursoForm.status} onValueChange={v => setCursoForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Ordem</Label>
                <Input type="number" value={cursoForm.ordem} onChange={e => setCursoForm(f => ({ ...f, ordem: +e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCursoModal(false)}>Cancelar</Button>
            <Button onClick={saveCurso} disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Módulo ── */}
      <Dialog open={moduloModal} onOpenChange={setModuloModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Editar módulo" : "Novo módulo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input value={moduloForm.titulo} onChange={e => setModuloForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Fundamentos da Captação" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descrição</Label>
              <Textarea value={moduloForm.descricao} onChange={e => setModuloForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ordem</Label>
              <Input type="number" value={moduloForm.ordem} onChange={e => setModuloForm(f => ({ ...f, ordem: +e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModuloModal(false)}>Cancelar</Button>
            <Button onClick={saveModulo} disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Aula ── */}
      <Dialog open={aulaModal} onOpenChange={setAulaModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input value={aulaForm.titulo} onChange={e => setAulaForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={aulaForm.tipo} onValueChange={v => setAulaForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="texto">Texto / Leitura</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="link">Link externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Duração (min)</Label>
                <Input type="number" value={aulaForm.duracao_min} onChange={e => setAulaForm(f => ({ ...f, duracao_min: +e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Ordem</Label>
                <Input type="number" value={aulaForm.ordem} onChange={e => setAulaForm(f => ({ ...f, ordem: +e.target.value }))} />
              </div>
            </div>

            {aulaForm.tipo === "video" && (
              <div className="grid gap-1.5">
                <Label>URL do vídeo (YouTube, Vimeo ou MP4 direto)</Label>
                <Input value={aulaForm.video_url} onChange={e => setAulaForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            )}
            {aulaForm.tipo === "pdf" && (
              <div className="grid gap-1.5">
                <Label>URL do PDF</Label>
                <Input value={aulaForm.arquivo_url} onChange={e => setAulaForm(f => ({ ...f, arquivo_url: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            {aulaForm.tipo === "link" && (
              <div className="grid gap-1.5">
                <Label>Link externo</Label>
                <Input value={aulaForm.link_externo} onChange={e => setAulaForm(f => ({ ...f, link_externo: e.target.value }))} placeholder="https://..." />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Conteúdo HTML {aulaForm.tipo === "texto" ? "*" : "(complementar)"}</Label>
              <Textarea
                value={aulaForm.conteudo_html}
                onChange={e => setAulaForm(f => ({ ...f, conteudo_html: e.target.value }))}
                rows={10}
                className="font-mono text-xs"
                placeholder="<h2>Título</h2><p>Parágrafo...</p>"
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="gratuita" checked={aulaForm.gratuita} onChange={e => setAulaForm(f => ({ ...f, gratuita: e.target.checked }))} className="h-4 w-4 rounded" />
              <Label htmlFor="gratuita" className="cursor-pointer">Aula gratuita (preview sem matrícula)</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAulaModal(false)}>Cancelar</Button>
            <Button onClick={saveAula} disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
