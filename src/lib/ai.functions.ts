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