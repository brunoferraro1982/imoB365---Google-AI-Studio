import { GoogleGenAI } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const DEFAULT_MODEL = "gemini-3.5-flash";

async function callAI(messages: Array<{ role: string; content: string }>, opts?: { jsonMode?: boolean; model?: string }) {
  const systemMessage = messages.find((m) => m.role === "system")?.content;
  const userMessage = messages.find((m) => m.role === "user")?.content || "";

  try {
    const config: Record<string, any> = {};
    if (systemMessage) {
      config.systemInstruction = systemMessage;
    }
    if (opts?.jsonMode) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: opts?.model ?? DEFAULT_MODEL,
      contents: userMessage,
      config,
    });

    const content = response.text;
    if (!content) throw new Error("Resposta da IA vazia");
    return content;
  } catch (error: any) {
    throw new Error(`Erro IA: ${error.message || error}`);
  }
}

const ImovelInput = z.object({
  titulo: z.string().max(200).optional().default(""),
  finalidade: z.string().max(40).optional().default("venda"),
  tipo: z.string().max(60).optional().default("apartamento"),
  bairro: z.string().max(120).optional().default(""),
  cidade: z.string().max(120).optional().default(""),
  quartos: z.number().int().nullable().optional(),
  area_util: z.number().nullable().optional(),
  preco: z.number().nullable().optional(),
  caracteristicas: z.string().max(2000).optional().default(""),
  tom: z.enum(["profissional", "acolhedor", "luxo", "objetivo"]).optional().default("profissional"),
});

function imovelBriefing(data: z.infer<typeof ImovelInput>) {
  const linhas = [
    `Finalidade: ${data.finalidade}`,
    `Tipo: ${data.tipo}`,
    data.titulo ? `Título atual: ${data.titulo}` : null,
    data.bairro || data.cidade ? `Localização: ${[data.bairro, data.cidade].filter(Boolean).join(" / ")}` : null,
    data.quartos ? `Quartos: ${data.quartos}` : null,
    data.area_util ? `Área útil: ${data.area_util} m²` : null,
    data.preco ? `Preço: R$ ${data.preco.toLocaleString("pt-BR")}` : null,
    data.caracteristicas ? `Características: ${data.caracteristicas}` : null,
  ].filter(Boolean).join("\n");
  return linhas || "Imóvel residencial.";
}

/** Gera descrição comercial completa (texto longo) para o anúncio do imóvel. */
export const gerarDescricaoImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImovelInput.parse(d))
  .handler(async ({ data }) => {
    const system =
      "Você é um redator publicitário do mercado imobiliário brasileiro. Escreva descrições claras, persuasivas e honestas, sem clichês exagerados. Use português do Brasil, parágrafos curtos, listas quando útil. Não invente dados que não foram informados.";
    const user = `Gere uma descrição de anúncio (250–400 palavras) com o tom "${data.tom}" para este imóvel:\n\n${imovelBriefing(data)}\n\nEstrutura sugerida:\n1) Abertura com destaque do imóvel.\n2) Detalhes do espaço e diferenciais.\n3) Localização e vizinhança.\n4) Chamada para ação.\n\nResponda apenas com o texto final, sem títulos extras.`;
    const text = await callAI([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return { descricao: text.trim() };
  });

/** Gera um título curto e atrativo para o anúncio. */
export const gerarTituloImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImovelInput.parse(d))
  .handler(async ({ data }) => {
    const system = "Você cria títulos de anúncios imobiliários brasileiros. Curto, factual, atrativo, no máximo 80 caracteres. Sem emojis. Sem aspas.";
    const user = `Gere 3 sugestões de título para o anúncio deste imóvel, uma por linha, sem numerar:\n\n${imovelBriefing(data)}`;
    const text = await callAI([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    const titulos = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\d).\-•\s]+/, "").trim())
      .filter((l) => l.length > 0 && l.length <= 120)
      .slice(0, 3);
    return { titulos };
  });

/** Gera copy para redes sociais (Instagram / Facebook). */
export const gerarPostRedesImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImovelInput.parse(d))
  .handler(async ({ data }) => {
    const system = "Você é social media de imobiliária no Brasil. Crie posts diretos, com gancho, 3–5 hashtags ao final, sem inventar dados.";
    const user = `Gere um post (texto curto, até 600 caracteres) para Instagram/Facebook divulgando este imóvel:\n\n${imovelBriefing(data)}\n\nResponda apenas com o texto do post.`;
    const text = await callAI([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return { post: text.trim() };
  });

const SeoInput = z.object({
  titulo: z.string().max(200),
  descricao: z.string().max(4000).optional().default(""),
  bairro: z.string().max(120).optional().default(""),
  cidade: z.string().max(120).optional().default(""),
  tipo: z.string().max(60).optional().default("apartamento"),
});

export const gerarMetatagsSEO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SeoInput.parse(d))
  .handler(async ({ data }) => {
    const system = "Você é um especialista em SEO no mercado imobiliário brasileiro. Retorne apenas um JSON estruturado com chave e valor correspondentes.";
    const user = `Otimize o SEO para este imóvel:\nTítulo: ${data.titulo}\nDescrição: ${data.descricao}\nLocalização: ${data.bairro} - ${data.cidade}\nTipo: ${data.tipo}\n\nRetorne obrigatoriamente um objeto JSON com as seguintes chaves:\n- "seo_title": título SEO altamente amigável para motores de busca (máximo 60 caracteres)\n- "meta_description": resumo focado em cliques com tags de relevância (máximo 155 caracteres) contendo localização\n- "keywords": lista de até 6 palavras-chave separadas por vírgula.`;
    const response = await callAI([
      { role: "system", content: system },
      { role: "user", content: user },
    ], { jsonMode: true });

    try {
      const parsed = JSON.parse(response);
      return { seo: parsed };
    } catch {
      return {
        seo: {
          seo_title: `${data.tipo} em ${data.bairro}, ${data.cidade} | imob365`,
          meta_description: `Confira este excelente ${data.tipo} em ${data.bairro}, ${data.cidade}. Detalhes completos e fotos profissionais. Solicite sua visita!`,
          keywords: `${data.tipo}, ${data.bairro}, imóvel em ${data.cidade}, imob365`
        }
      };
    }
  });

const InterpretadorInput = z.object({
  mensagem: z.string().max(800),
});

export const interpretarBuscaConversacional = createServerFn({ method: "POST" })
  .inputValidator((d) => InterpretadorInput.parse(d))
  .handler(async ({ data }) => {
    const system = `Você é o corretor virtual inteligente da imob365. Sua tarefa é interpretar o que o usuário quer em linguagem natural e responder com dados estruturados para filtrar imóveis no portal.
Retorne SEMPRE um JSON válido contendo obrigatoriamente as chaves:
- "resposta_amigavel": mensagem curta e simpática direcionada ao cliente resumindo o que você entendeu e quais filtros foram aplicados (em português, sem aspas extras, máximo 250 caracteres).
- "q": termo geral de busca ou bairro (string, vazia se não especificado)
- "finalidade": obrigatoriamente um valor entre "todos", "venda" ou "aluguel" (ou "temporada" se falarem aluguel de temporada/praia). Default "todos".
- "tipo": tipo do imóvel: "apartamento", "casa", "terreno", "cobertura", "comercial" (string, vazia se não especificado)
- "quartos": quantidade de quartos mínima como string de número (ex: "2", "3", "4", ou "" se não especificado)
- "banheiros": quantidade de banheiros mínima como string de número (ex: "2", "3", ou "" se não especificado)
- "precoMax": valor máximo (em reais, como string numérica sem pontos Ex: "800000", ou "" se não especificado)
- "precoMin": valor mínimo (em reais, como string numérica sem pontos Ex: "200000", ou "" se não especificado)
- "areaMin": área útil construída mínima (como string numérica Ex: "80", ou "" se não especificado)
- "caracteristicasSelecionadas": lista de amenidades identificadas (ex: ["piscina", "academia", "churrasqueira", "varanda gourmet", "mobiliado", "portaria 24h", "aceita pet"])`;

    const user = `Considere a mensagem do usuário:\n"${data.mensagem}"\n\nAnalise e retorne o JSON estruturado correspondente.`;

    const response = await callAI([
      { role: "system", content: system },
      { role: "user", content: user },
    ], { jsonMode: true });

    try {
      const parsed = JSON.parse(response);
      return { bot: parsed };
    } catch {
      return {
        bot: {
          resposta_amigavel: "Entendi o seu desejo! Busquei os melhores imóveis disponíveis conforme as suas indicações.",
          q: "",
          finalidade: "todos",
          tipo: "",
          quartos: "",
          banheiros: "",
          precoMax: "",
          precoMin: "",
          areaMin: "",
          caracteristicasSelecionadas: []
        }
      };
    }
  });