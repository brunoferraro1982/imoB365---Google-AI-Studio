// Assistente de IA (RAG + Llama local via Ollama). Motivo do RAG ser
// obrigatório, não opcional: testado manualmente contra o modelo real
// (llama3.2:3b) sem contexto, a pergunta "o que é ITBI" gerou uma resposta
// com o significado da sigla INVENTADO ("Imposto sobre Transmissão
// Bucólica") e detalhes fabricados sobre como o imposto funciona. O
// system prompt abaixo instrui o modelo a responder SÓ com base no
// contexto fornecido — nunca do próprio conhecimento interno pra fatos de
// domínio (tributos, legislação, etc.).

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = "llama3.2:3b";

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

/** Busca os trechos mais relevantes da base de conhecimento + blog público via full-text search. */
export async function buscarContexto(
  pergunta: string,
  client: AiAssistantSupabaseClient,
  paginaAtual?: string,
): Promise<string[]> {
  const trechos: string[] = [];
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
  { prefixo: "/app/leads/captacao", nome: "Captação Automática de leads" },
  { prefixo: "/app/leads/analise-risco", nome: "Análise de Risco (score de crédito)" },
  { prefixo: "/app/leads", nome: "Funil de leads (Kanban)" },
  { prefixo: "/app/comissoes", nome: "Comissões" },
  { prefixo: "/app/financeiro/dashboard", nome: "Dashboard executivo do Financeiro" },
  { prefixo: "/app/financeiro", nome: "Financeiro (contas a pagar e receber)" },
  { prefixo: "/app/locacao/repasses", nome: "Repasses de aluguel ao proprietário (locação)" },
  { prefixo: "/app/locacao/prestacao-contas", nome: "Prestação de contas (locação)" },
  { prefixo: "/app/portais", nome: "Anúncios em portais externos (Marketing)" },
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
  { prefixo: "/app/configuracoes/integracoes-erp", nome: "Integrações ERP" },
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

function buildSystemPrompt(contexto: string[], paginaAtual?: string): string {
  const tela = nomeAmigavelDaPagina(paginaAtual);
  const base = `Você é o assistente de IA da imoB365, especializado em mercado imobiliário brasileiro e em como usar a plataforma imoB365. Responda de forma direta, curta (no máximo 4-5 frases) e em português do Brasil.

REGRA MAIS IMPORTANTE: para qualquer fato específico (impostos, percentuais, documentos exigidos, prazos legais, valores), use SOMENTE as informações no CONTEXTO abaixo. Nunca invente ou complete com conhecimento próprio quando o contexto não cobrir o assunto — nesse caso, diga que não tem essa informação específica e sugira falar com o suporte da imoB365. Não responda perguntas fora desses temas — redirecione educadamente.${
    tela
      ? `\n\nO usuário está agora na tela "${tela}" do backend da imoB365. Se a pergunta for genérica tipo "como uso isso" ou "o que eu faço aqui", priorize explicar essa tela específica usando o CONTEXTO.`
      : ""
  }`;

  if (contexto.length === 0) {
    return `${base}\n\nCONTEXTO: (nenhuma informação relevante encontrada na base de conhecimento para esta pergunta)`;
  }
  return `${base}\n\nCONTEXTO:\n${contexto.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`;
}

/** Chama o Ollama local em modo streaming, repassando cada trecho de texto gerado via callback. */
export async function perguntarAssistente(
  pergunta: string,
  client: AiAssistantSupabaseClient,
  onChunk: (texto: string) => void,
  paginaAtual?: string,
): Promise<void> {
  const contexto = await buscarContexto(pergunta, client, paginaAtual);
  const systemPrompt = buildSystemPrompt(contexto, paginaAtual);

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: pergunta },
      ],
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error("Assistente de IA indisponível no momento.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) onChunk(parsed.message.content);
      } catch {
        // linha incompleta/malformada — ignora, o NDJSON do Ollama é linha-a-linha
      }
    }
  }
}
