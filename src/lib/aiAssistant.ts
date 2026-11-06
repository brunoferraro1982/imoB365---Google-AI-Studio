import { GoogleGenAI } from "@google/genai";
// Assistente de IA (RAG + Llama local via Ollama). Motivo do RAG ser
// obrigatório, não opcional: testado manualmente contra o modelo real
// (llama3.2:3b) sem contexto, a pergunta "o que é ITBI" gerou uma resposta
// com o significado da sigla INVENTADO ("Imposto sobre Transmissão
// Bucólica") e detalhes fabricados sobre como o imposto funciona. O
// system prompt abaixo instrui o modelo a responder SÓ com base no
// contexto fornecido — nunca do próprio conhecimento interno pra fatos de
// domínio (tributos, legislação, etc.).

// Assistente do /app e sugestão de resposta da Central: Gemini Flash-Lite
// (2026-11). Antes era o Ollama da VPS (llama3.2:3b em CPU): ~9 tokens/s
// (30s+ por resposta), resposta factual errada no teste (ITBI) e 2,4 GB de
// RAM presos. Flash-Lite pago custa centavos no volume real (~8 perguntas/
// mês em out/2026) e, no plano pago, o Google não usa os dados para treino —
// requisito aqui, porque o contexto inclui contratos e chamados dos tenants.
// "gemini-2.5-flash-lite" foi descontinuado para chaves novas (404 em 2026-11);
// a família 3.x não aceita thinkingBudget e já responde em ~1 s sem ajuste.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

let _gemini: InstanceType<typeof GoogleGenAI> | null = null;
function gemini(): InstanceType<typeof GoogleGenAI> {
  if (_gemini) return _gemini;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "SUA_GEMINI_KEY") {
    throw new Error("Assistente de IA indisponível: GEMINI_API_KEY não configurada.");
  }
  _gemini = new GoogleGenAI({ apiKey });
  return _gemini;
}

export interface AiAssistantSupabaseClient {
  from: (table: string) => any;
}

// Extração de texto puro (não sanitização de segurança — esse texto vai só
// pro prompt do LLM, nunca é renderizado como HTML de volta). Regex simples
// em vez de isomorphic-dompurify/jsdom deliberadamente: o pacote real de
// sanitização (src/lib/sanitizeHtml.ts) continua usando DOMPurify de verdade
// pra conteúdo que É renderizado no navegador — aqui, puxar jsdom (que arrasta
// css-tree, cujo require dinâmico de data/patch.json não é copiado pro bundle
// SSR do Nitro) quebrava a renderização de TODA rota em produção, não só
// desta, incidente real corrigido em 2026-07-24.
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// plainto_tsquery/websearch_to_tsquery exigem que TODAS as palavras da
// pergunta apareçam no texto (semântica AND) — testado manualmente: "Quais
// documentos preciso pra financiar?" não batia com a entrada da base sobre
// documentos de financiamento, porque "preciso"/"pra"/"quais" não aparecem
// no texto e travam o match inteiro. Construímos aqui uma query OR manual
// (tsquery bruta, sem type no .textSearch), filtrando palavras de baixo
// valor semântico e usando prefixo (:*) pra tolerar variação de forma —
// muito mais robusto pra pergunta em linguagem natural do que os tipos
// prontos do Postgres.
const PALAVRAS_IGNORADAS = new Set([
  "o",
  "a",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "que",
  "é",
  "um",
  "uma",
  "uns",
  "umas",
  "pra",
  "para",
  "com",
  "por",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "como",
  "qual",
  "quais",
  "quero",
  "preciso",
  "gostaria",
  "saber",
  "sobre",
  "meu",
  "minha",
  "e",
  "ou",
  "se",
  "tem",
  "vou",
]);

// IMPORTANTE: não remover acentos aqui. to_tsvector('portuguese', ...)
// mantém os acentos nos lexemas armazenados (a config 'portuguese' do
// Postgres não usa a extensão unaccent) — um termo de busca sem acento
// tipo "comissoes:*" NUNCA bate com o lexema armazenado "comissões",
// mesmo que a palavra seja idêntica pro leitor humano. Bug real, achado
// ao testar retrieval pra "Comissões" (query só retornava conteúdo
// errado) — o fix anterior (2026-07-24) que adicionava esse strip de
// acento partiu de uma suposição errada e nunca foi validado ponta-a-
// ponta com uma palavra cujo match dependesse SÓ do termo acentuado.
function extrairPalavras(texto: string): string[] {
  return texto
    .toLowerCase()
    .replace(/[^\p{L}0-9\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PALAVRAS_IGNORADAS.has(w));
}

// Perguntas genéricas ("como uso isso", "o que eu faço aqui") não carregam
// palavra-chave nenhuma sozinhas — misturamos os termos do nome amigável da
// tela atual (se houver) na busca, pra ainda assim achar o conteúdo certo.
function palavrasDaBusca(pergunta: string, paginaAtual?: string): string[] {
  const tela = nomeAmigavelDaPagina(paginaAtual);
  const palavras = [...extrairPalavras(pergunta), ...(tela ? extrairPalavras(tela) : [])];
  return [...new Set(palavras)];
}

function tsQuery(palavras: string[]): string | null {
  if (palavras.length === 0) return null;
  return palavras.map((w) => `${w}:*`).join(" | ");
}

// Achado real ao testar: uma palavra comum (ex. "imóvel") aparece em quase
// toda entrada da base, então o textSearch sozinho retorna muitos matches
// SEM nenhuma ordem de relevância (PostgREST/.textSearch não expõe
// ts_rank) — o .limit() de antes cortava de forma essencialmente
// arbitrária, às vezes descartando a entrada mais óbvia e relevante (ex.
// pergunta "Como cadastro um imóvel?" perdia a entrada "Como cadastrar um
// imóvel" pro corte). Corrigido buscando um pool maior e rankeando no
// client por nº de palavras da pergunta que aparecem — título pesa mais
// que conteúdo, é o sinal de relevância mais forte disponível aqui.
function ordenarPorRelevancia<T extends { titulo: string; corpo: string }>(
  itens: T[],
  palavras: string[],
): T[] {
  function score(item: T): number {
    const titulo = item.titulo.toLowerCase();
    const corpo = item.corpo.toLowerCase();
    return palavras.reduce((acc, p) => {
      if (titulo.includes(p)) return acc + 3;
      if (corpo.includes(p)) return acc + 1;
      return acc;
    }, 0);
  }
  return [...itens].sort((a, b) => score(b) - score(a));
}

function fmtDataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtMoeda(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function partesPorPapel(partes: { papel: string; nome: string }[], papel: string): string {
  const nomes = partes.filter((p) => p.papel === papel).map((p) => p.nome);
  return nomes.length > 0 ? nomes.join("; ") : "—";
}

// Mesmo formato de variável ({{contrato.numero}}, {{partes.locador}}, etc.)
// já usado em app.contratos.$id_.imprimir.tsx — reimplementado aqui (não
// importado de lá) porque aquele arquivo é client-only (useMemo/React), e
// esta função roda tanto no server (rota de IA) quanto precisa ser simples
// o bastante pra virar texto de prompt, não HTML de impressão.
function interpolarTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => ctx[key] ?? "");
}

/**
 * CLM Sprint 14 — contexto RAG específico de um contrato: dados gerais +
 * partes + o modelo de contrato aplicável (interpolado), quando a pergunta
 * é feita dentro de app.contratos.$id.tsx. Mesma disciplina anti-alucinação
 * do resto do assistente: só entra no CONTEXTO o que está de fato gravado
 * no banco pra este contrato — nunca inventado.
 */
export async function buscarContextoContrato(
  contratoId: string,
  client: AiAssistantSupabaseClient,
): Promise<string[]> {
  const trechos: string[] = [];

  const { data: contrato } = await client
    .from("contratos")
    .select(
      "id,tenant_id,numero,tipo,status,valor,data_inicio,data_fim,comissao_percentual,comissao_valor,assinatura_status,etapa_atual",
    )
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato) return trechos;

  const { data: partesData } = await client
    .from("contrato_partes")
    .select("papel,nome")
    .eq("contrato_id", contratoId);
  const partes: { papel: string; nome: string }[] = partesData ?? [];

  const ctx: Record<string, string> = {
    "contrato.numero": contrato.numero ?? `#${String(contrato.id).slice(0, 8)}`,
    "contrato.tipo": contrato.tipo,
    "contrato.status": contrato.status,
    "contrato.valor": fmtMoeda(contrato.valor),
    "contrato.data_inicio": fmtDataBR(contrato.data_inicio),
    "contrato.data_fim": fmtDataBR(contrato.data_fim),
    "contrato.comissao_percentual": contrato.comissao_percentual
      ? `${contrato.comissao_percentual}%`
      : "—",
    "contrato.comissao_valor": fmtMoeda(contrato.comissao_valor),
    "partes.vendedor": partesPorPapel(partes, "vendedor"),
    "partes.comprador": partesPorPapel(partes, "comprador"),
    "partes.locador": partesPorPapel(partes, "locador"),
    "partes.locatario": partesPorPapel(partes, "locatario"),
    "partes.fiador": partesPorPapel(partes, "fiador"),
  };

  const resumo = `Contrato ${ctx["contrato.numero"]} — tipo: ${ctx["contrato.tipo"]}, status: ${ctx["contrato.status"]}, etapa: ${contrato.etapa_atual ?? "—"}, valor: ${ctx["contrato.valor"]}, vigência: ${ctx["contrato.data_inicio"]} a ${ctx["contrato.data_fim"]}, assinatura: ${contrato.assinatura_status ?? "—"}. Vendedor/Locador: ${ctx["partes.vendedor"] !== "—" ? ctx["partes.vendedor"] : ctx["partes.locador"]}. Comprador/Locatário: ${ctx["partes.comprador"] !== "—" ? ctx["partes.comprador"] : ctx["partes.locatario"]}.`;
  trechos.push(resumo);

  const { data: template } = await client
    .from("contrato_templates")
    .select("nome,conteudo")
    .eq("tenant_id", contrato.tenant_id)
    .eq("tipo", contrato.tipo)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (template?.conteudo) {
    const texto = stripHtml(interpolarTemplate(template.conteudo, ctx)).slice(0, 3000);
    trechos.push(`Cláusulas do modelo "${template.nome}" aplicado a este contrato: ${texto}`);
  }

  return trechos;
}

// Central de Atendimento Sprint 9 — contexto do chamado (assunto + thread)
// pra sugestão de resposta. Notas internas entram no contexto (o agente que
// pede a sugestão já as vê na própria tela) mas o prompt final instrui o
// modelo a nunca reproduzi-las na resposta sugerida (essa é sempre voltada
// ao cliente).
async function buscarContextoChamado(
  chamadoId: string,
  client: AiAssistantSupabaseClient,
): Promise<{ trechos: string[]; assunto: string; categoria: string }> {
  const { data: chamado } = await client
    .from("chamados")
    .select("assunto,categoria,status")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!chamado) return { trechos: [], assunto: "", categoria: "" };

  const { data: mensagensData } = await client
    .from("chamado_mensagens")
    .select("autor_tipo,conteudo,interno,created_at")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true })
    .limit(30);
  const mensagens: { autor_tipo: string; conteudo: string; interno: boolean }[] =
    mensagensData ?? [];

  const transcricao = mensagens
    .map((m) => {
      const autor =
        m.autor_tipo === "cliente" ? "Cliente" : m.interno ? "Nota interna do agente" : "Agente";
      return `${autor}: ${m.conteudo}`;
    })
    .join("\n");

  const trechos = [
    `Chamado — assunto: "${chamado.assunto}", categoria: ${chamado.categoria}, status: ${chamado.status}.`,
  ];
  if (transcricao) trechos.push(`Conversa até agora:\n${transcricao}`);

  return { trechos, assunto: chamado.assunto, categoria: chamado.categoria };
}

/** Busca os trechos mais relevantes da base de conhecimento + blog público via full-text search. */
export async function buscarContexto(
  pergunta: string,
  client: AiAssistantSupabaseClient,
  paginaAtual?: string,
  contratoId?: string,
): Promise<string[]> {
  const trechos: string[] = [];
  if (contratoId) {
    trechos.push(...(await buscarContextoContrato(contratoId, client)));
  }
  const palavras = palavrasDaBusca(pergunta, paginaAtual);
  const query = tsQuery(palavras);
  if (!query) return trechos;

  const { data: kbBruto } = await client
    .from("ai_knowledge_base")
    .select("titulo, conteudo")
    .textSearch("busca", query, { config: "portuguese" })
    .eq("ativo", true)
    .limit(20);
  const kbTyped: { titulo: string; conteudo: string }[] = kbBruto ?? [];
  const kb = ordenarPorRelevancia(
    kbTyped.map((item) => ({ ...item, corpo: item.conteudo })),
    palavras,
  ).slice(0, 4);
  for (const item of kb) {
    trechos.push(`${item.titulo}: ${item.conteudo}`);
  }

  const { data: tenant } = await client
    .from("tenants")
    .select("id")
    .eq("slug", "imob365")
    .maybeSingle();
  if (tenant?.id) {
    const { data: posts } = await client
      .from("blog_posts")
      .select("titulo, resumo, conteudo")
      .eq("tenant_id", tenant.id)
      .eq("status", "publicado")
      .textSearch("titulo", query, { config: "portuguese" })
      .limit(2);
    for (const post of posts ?? []) {
      const texto = post.resumo ? stripHtml(post.resumo) : stripHtml(post.conteudo).slice(0, 500);
      trechos.push(`${post.titulo}: ${texto}`);
    }
  }

  return trechos;
}

// Mapeia o caminho atual (enviado pelo cliente, ex. "/app/imoveis/novo") pra
// um nome amigável de tela — só pra dar contexto ao prompt, nunca inventado:
// path sem entrada aqui simplesmente não gera nenhuma dica de tela. Prefixos
// mais específicos primeiro (ordem importa no .find abaixo).
const TELAS_BACKEND: { prefixo: string; nome: string }[] = [
  { prefixo: "/app/imoveis/novo", nome: "Cadastro de novo imóvel" },
  { prefixo: "/app/imoveis/importar", nome: "Importação de imóveis em lote" },
  { prefixo: "/app/imoveis", nome: "Gestão de imóveis" },
  { prefixo: "/app/leads/analise-risco", nome: "Análise de Risco (score de crédito)" },
  { prefixo: "/app/leads", nome: "Funil de leads (Kanban)" },
  { prefixo: "/app/comissoes", nome: "Comissões" },
  { prefixo: "/app/financeiro/dashboard", nome: "Dashboard executivo do Financeiro" },
  { prefixo: "/app/financeiro", nome: "Financeiro (contas a pagar e receber)" },
  { prefixo: "/app/locacao/repasses", nome: "Repasses de aluguel ao proprietário (locação)" },
  { prefixo: "/app/locacao/prestacao-contas", nome: "Prestação de contas (locação)" },
  { prefixo: "/app/portais/meta", nome: "Redes sociais (Marketing)" },
  { prefixo: "/app/parcerias", nome: "Parcerias (Marketing)" },
  { prefixo: "/app/site", nome: "Site da imobiliária" },
  { prefixo: "/app/contratos", nome: "Contratos (Jurídico)" },
  { prefixo: "/app/configuracoes/equipe", nome: "Gestão de equipe" },
  {
    prefixo: "/app/configuracoes/integracoes-bancarias/mercadopago",
    nome: "Conexão com o Mercado Pago",
  },
  { prefixo: "/app/configuracoes/integracoes-bancarias", nome: "Integrações Bancárias" },
  { prefixo: "/app/configuracoes/conciliacao-bancaria", nome: "Conciliação Bancária" },
  { prefixo: "/app/configuracoes", nome: "Configurações" },
  { prefixo: "/app/elearning", nome: "E-Learning" },
  { prefixo: "/app/relatorios", nome: "Relatórios" },
  { prefixo: "/app/visitas", nome: "Agenda de visitas" },
  { prefixo: "/app/tarefas", nome: "Tarefas" },
  { prefixo: "/app", nome: "Painel inicial do backend" },
];

function nomeAmigavelDaPagina(pathname: string | undefined): string | null {
  if (!pathname) return null;
  const encontrada = TELAS_BACKEND.find((t) => pathname.startsWith(t.prefixo));
  return encontrada?.nome ?? null;
}

function buildSystemPrompt(
  contexto: string[],
  paginaAtual?: string,
  temContratoEspecifico?: boolean,
): string {
  const tela = nomeAmigavelDaPagina(paginaAtual);
  const base = `Você é o assistente de IA da imoB365, especializado em mercado imobiliário brasileiro e em como usar a plataforma imoB365. Responda de forma direta, curta (no máximo 4-5 frases) e em português do Brasil.

REGRA MAIS IMPORTANTE: para qualquer fato específico (impostos, percentuais, documentos exigidos, prazos legais, valores), use SOMENTE as informações no CONTEXTO abaixo. Nunca invente ou complete com conhecimento próprio quando o contexto não cobrir o assunto — nesse caso, diga que não tem essa informação específica e sugira falar com o suporte da imoB365. Não responda perguntas fora desses temas — redirecione educadamente.${
    temContratoEspecifico
      ? `\n\nO usuário está vendo um contrato específico agora — o CONTEXTO abaixo inclui os dados reais e as cláusulas desse contrato. Priorize responder sobre ESTE contrato quando a pergunta for genérica tipo "resuma este contrato" ou "quais as condições aqui".`
      : tela
        ? `\n\nO usuário está agora na tela "${tela}" do backend da imoB365. Se a pergunta for genérica tipo "como uso isso" ou "o que eu faço aqui", priorize explicar essa tela específica usando o CONTEXTO.`
        : ""
  }`;

  if (contexto.length === 0) {
    return `${base}\n\nCONTEXTO: (nenhuma informação relevante encontrada na base de conhecimento para esta pergunta)`;
  }
  return `${base}\n\nCONTEXTO:\n${contexto.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`;
}

// ─── Respostas prontas da base de conhecimento ────────────────────────────
// Quando a pergunta casa com força com o TÍTULO de uma entrada da
// ai_knowledge_base ("Como cadastro um imóvel?" ≈ "Como cadastrar um
// imóvel"), devolvemos o conteúdo da entrada direto — instantâneo, sem IA e
// sem custo. O conteúdo da base é a fonte oficial de qualquer forma.

const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const VAZIAS_TITULO = new Set(
  "como que qual quais onde quando para pra por uma umas uns com sem dos das nos nas meu minha esse essa este esta isso aqui funciona funcionam fazer faco faço dar posso consigo preciso quero tem tenho numa num".split(
    " ",
  ),
);

// Sinônimos de uso comum → termo que a base usa
const SINONIMOS: Record<string, string> = {
  anuncio: "imovel",
  anuncios: "imovel",
  apto: "imovel",
  boleto: "cobranca",
  vendedor: "corretor",
  vendedores: "corretor",
  cliente: "lead",
  clientes: "lead",
  nf: "nota",
  nfe: "nota",
};

function termos(texto: string): string[] {
  return semAcento(texto)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !VAZIAS_TITULO.has(w))
    .map((w) => SINONIMOS[w] ?? w);
}

/** Raiz simples de verbos/plurais: "gero"/"gerar" → "ger", "lanco"/"lancar" → "lanc". */
function raiz(w: string): string {
  if (w.length <= 4) return w.replace(/(o|a|e|s)$/, "");
  return w.replace(
    /(ando|endo|indo|ados|adas|ado|ada|idos|ido|ida|amos|emos|ar|er|ir|as|es|os|o|a|e)$/,
    "",
  );
}

/** "cadastro" ≈ "cadastrar", "lanco" ≈ "lancar" — prefixo comum suficiente. */
function mesmaRaiz(a: string, b: string): boolean {
  if (a === b) return true;
  const ra = raiz(a);
  if (ra.length >= 3 && ra === raiz(b)) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= Math.min(5, Math.min(a.length, b.length) - 1) && i >= 4;
}

/** Cobertura da pergunta pelo título (0–1). */
export function scoreTitulo(pergunta: string, titulo: string): number {
  const q = termos(pergunta);
  const t = termos(titulo);
  if (q.length === 0 || t.length === 0) return 0;
  const acertos = q.filter((w) => t.some((x) => mesmaRaiz(w, x))).length;
  return acertos < Math.min(2, q.length) ? 0 : acertos / q.length;
}

// Casamento forte: responde direto da base em qualquer caso.
const SCORE_RESPOSTA_PRONTA = 0.67;
// Casamento médio: responde da base se a pergunta for sobre a plataforma
// (decisão de produto: perguntas da plataforma usam sempre a base; a IA é
// último recurso ou para temas fora da plataforma).
const SCORE_PLATAFORMA = 0.45;
const SCORE_RELACIONADA = 0.34;

const PISTAS_PLATAFORMA =
  /\b(imob ?365|plataforma|sistema|app|tela|menu|botao|aba|cadastr\w*|configur\w*|painel|dashboard|relatori\w*|leads?|funil|kanban|imove\w*|imovel|corretor\w*|equipe|contratos?|comiss\w*|financeir\w*|lancament\w*|lanc\w*|repasses?|locac\w*|site|portais|portal|anuncio\w*|anunci\w*|chamados?|atendimento|plano|planos|assinatura|usuario\w*|senha|login|permiss\w*|integra\w*|whatsapp|e-?mail|notifica\w*|curso\w*|elearning|e-learning|tarefas?|visitas?|agenda|qr|cartao|blog|webhooks?|api|nota fiscal|nfs-?e|nota|perfil|foto\w*|importar|exportar|duplicar|publicar|contas?|baixa|pag\w*|despesas?|receitas?|cobranc\w*|pix|modelos?|pdf|imprimir|docusign|clicksign|cartorio\w*|mfa|2fa|lgpd|privacidade|tema|modo escuro|trial|teste gratis|onboarding|favorit\w*|chave|cota|limite|modulos?|parceri\w*|qr ?code|google ads|canva|instagram|facebook|marca d.?agua)\b/;

export function ehSobrePlataforma(pergunta: string): boolean {
  return PISTAS_PLATAFORMA.test(semAcento(pergunta));
}

type ItemKb = { titulo: string; conteudo: string; perguntas?: string[] | null };

async function carregarKb(client: AiAssistantSupabaseClient): Promise<ItemKb[]> {
  const comPerguntas = await client
    .from("ai_knowledge_base")
    .select("titulo, conteudo, perguntas")
    .eq("ativo", true)
    .limit(500);
  if (!comPerguntas.error) return comPerguntas.data ?? [];
  // Banco ainda sem a coluna "perguntas" (migration 20261103180000 pendente)
  const { data } = await client
    .from("ai_knowledge_base")
    .select("titulo, conteudo")
    .eq("ativo", true)
    .limit(500);
  return data ?? [];
}

/** Melhor score da pergunta contra o título e as variações de uma entrada. */
export function scoreEntrada(pergunta: string, item: ItemKb): number {
  let melhor = scoreTitulo(pergunta, item.titulo);
  for (const p of item.perguntas ?? []) {
    const sc = scoreTitulo(pergunta, p);
    if (sc > melhor) melhor = sc;
    if (melhor >= 1) break;
  }
  return melhor;
}

async function respostaPronta(
  pergunta: string,
  client: AiAssistantSupabaseClient,
): Promise<{ item: ItemKb; relacionadas: string[] } | null> {
  const ranking = (await carregarKb(client))
    .map((item) => ({ item, score: scoreEntrada(pergunta, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const melhor = ranking[0];
  if (!melhor) return null;
  const aceita =
    melhor.score >= SCORE_RESPOSTA_PRONTA ||
    (melhor.score >= SCORE_PLATAFORMA && ehSobrePlataforma(pergunta));
  if (!aceita) return null;
  const relacionadas = ranking
    .slice(1)
    .filter((r) => r.score >= SCORE_RELACIONADA)
    .slice(0, 2)
    .map((r) => r.item.titulo);
  return { item: melhor.item, relacionadas };
}

/**
 * Responde em streaming: perguntas sobre a plataforma saem da base de
 * conhecimento (instantâneo, sem custo); o Gemini Flash-Lite, com o CONTEXTO
 * da base/contrato/blog, fica como último recurso ou para temas de fora.
 * Perguntas sobre um contrato específico vão sempre para a IA.
 */
export async function perguntarAssistente(
  pergunta: string,
  client: AiAssistantSupabaseClient,
  onChunk: (texto: string) => void,
  paginaAtual?: string,
  contratoId?: string,
): Promise<void> {
  if (!contratoId) {
    const pronta = await respostaPronta(pergunta, client);
    if (pronta) {
      const veja = pronta.relacionadas.length
        ? `\n\nVeja também: ${pronta.relacionadas.map((t) => `“${t}”`).join(" · ")}`
        : "";
      onChunk(
        `${pronta.item.conteudo}${veja}\n\n— Base de conhecimento imoB365: “${pronta.item.titulo}”`,
      );
      return;
    }
  }
  const contexto = await buscarContexto(pergunta, client, paginaAtual, contratoId);
  const systemPrompt = buildSystemPrompt(contexto, paginaAtual, !!contratoId);
  await chamarGeminiStreaming(systemPrompt, pergunta, onChunk);
}

/** Gemini 3.5 Flash-Lite em streaming. */
async function chamarGeminiStreaming(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (texto: string) => void,
): Promise<void> {
  let stream;
  try {
    stream = await gemini().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    });
  } catch (err) {
    console.error("[aiAssistant] Gemini falhou:", err);
    throw new Error("Assistente de IA indisponível no momento.");
  }
  for await (const parte of stream) {
    const texto = parte.text;
    if (texto) onChunk(texto);
  }
}

/**
 * Sugestão de resposta pro agente — Central de Atendimento Sprint 9. Usa a
 * transcrição do chamado (buscarContextoChamado) + base de conhecimento
 * relacionada ao assunto/categoria (buscarContexto, reaproveitando a mesma
 * busca full-text da KB) pra rascunhar uma resposta, nunca pra enviar
 * automaticamente — o agente sempre revisa/edita antes de enviar.
 */
export async function sugerirRespostaChamado(
  chamadoId: string,
  client: AiAssistantSupabaseClient,
  onChunk: (texto: string) => void,
): Promise<void> {
  const {
    trechos: trechosChamado,
    assunto,
    categoria,
  } = await buscarContextoChamado(chamadoId, client);
  if (trechosChamado.length === 0) {
    throw new Error("Chamado não encontrado.");
  }
  const trechosKb = await buscarContexto(`${assunto} ${categoria}`, client);
  const contexto = [...trechosChamado, ...trechosKb];

  const systemPrompt = `Você é o assistente de IA da imoB365, ajudando um agente de atendimento a redigir a PRÓXIMA resposta de um chamado de suporte. Escreva em português do Brasil, tom profissional e cordial, direto (no máximo 5-6 frases), pronto pra ser revisado e enviado pelo agente — não é uma resposta automática.

REGRAS: (1) Nunca reproduza o conteúdo de "Nota interna do agente" na resposta — notas internas são só contexto pra você entender a situação, nunca aparecem pro cliente. (2) Para qualquer fato específico (impostos, prazos, documentos, valores), use SOMENTE o CONTEXTO abaixo — se não houver informação suficiente, escreva uma resposta genérica pedindo mais detalhes ou avisando que vai verificar, nunca invente. (3) Responda só com o texto da mensagem sugerida, sem saudações de e-mail redundantes tipo "Prezado(a)" a menos que o tom da conversa já use isso.

CONTEXTO:\n${contexto.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`;

  await chamarGeminiStreaming(systemPrompt, "Sugira a próxima resposta pra este chamado.", onChunk);
}
