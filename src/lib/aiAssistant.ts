import DOMPurify from "isomorphic-dompurify";

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

function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).replace(/\s+/g, " ").trim();
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

function buildOrQuery(pergunta: string): string | null {
  const palavras = pergunta
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PALAVRAS_IGNORADAS.has(w));
  const unicas = [...new Set(palavras)];
  if (unicas.length === 0) return null;
  return unicas.map((w) => `${w}:*`).join(" | ");
}

/** Busca os trechos mais relevantes da base de conhecimento + blog público via full-text search. */
export async function buscarContexto(
  pergunta: string,
  client: AiAssistantSupabaseClient,
): Promise<string[]> {
  const trechos: string[] = [];
  const query = buildOrQuery(pergunta);
  if (!query) return trechos;

  const { data: kb } = await client
    .from("ai_knowledge_base")
    .select("titulo, conteudo")
    .textSearch("busca", query, { config: "portuguese" })
    .eq("ativo", true)
    .limit(4);
  for (const item of kb ?? []) {
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

function buildSystemPrompt(contexto: string[]): string {
  const base = `Você é o assistente de IA da imoB365, especializado em mercado imobiliário brasileiro. Responda de forma direta, curta (no máximo 4-5 frases) e em português do Brasil.

REGRA MAIS IMPORTANTE: para qualquer fato específico (impostos, percentuais, documentos exigidos, prazos legais, valores), use SOMENTE as informações no CONTEXTO abaixo. Nunca invente ou complete com conhecimento próprio quando o contexto não cobrir o assunto — nesse caso, diga que não tem essa informação específica e sugira falar com um corretor da imoB365. Não responda perguntas fora do tema de imóveis/mercado imobiliário — redirecione educadamente.`;

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
): Promise<void> {
  const contexto = await buscarContexto(pergunta, client);
  const systemPrompt = buildSystemPrompt(contexto);

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
