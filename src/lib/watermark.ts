// Marca d'água (logo do tenant) sobre fotos de imóvel, 100% client-side via
// <canvas> — mesmo padrão de resize/conversão WebP já usado em
// src/components/contratos/DocumentoUpload.tsx (comprimirImagem), estendido
// pra também compor uma segunda imagem (o logo) por cima antes de exportar.

const MAX_DIM = 1920;
const OUTPUT_QUALITY = 0.82;
const OUTPUT_TYPE = "image/webp";

// Proporção/posição/opacidade da marca — fixas por enquanto, não
// configuráveis pelo usuário (evita over-engineering num v1).
const WATERMARK_WIDTH_RATIO = 0.18;
const WATERMARK_MARGIN_RATIO = 0.03;
const WATERMARK_OPACITY = 0.8;

export type ResultadoMarcaDagua = { file: File; watermarked: boolean };

function nomeWebp(nomeOriginal: string): string {
  return nomeOriginal.replace(/\.[^.]+$/, "") + ".webp";
}

// Carrega o logo via fetch+blob (não via <img crossOrigin>) — um
// ImageBitmap decodificado a partir de um blob local nunca deixa o canvas
// "tainted"; qualquer problema de CORS aparece aqui como exceção explícita,
// nunca como falha silenciosa depois no toBlob().
async function carregarLogoBitmap(logoUrl: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(logoUrl, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

// Redimensiona (mesmo teto de comprimirImagem) e sobrepõe o logo no canto
// inferior direito. Qualquer falha em qualquer etapa retorna a melhor
// versão disponível (comprimida sem marca, ou o arquivo original cru) em
// vez de travar o upload — nunca lança. `watermarked` no retorno é o sinal
// explícito de sucesso real (não dá pra inferir isso só comparando
// referências de File — a versão "comprimida mas sem marca", quando o logo
// falha em carregar, também é sempre um File novo).
export async function aplicarMarcaDagua(file: File, logoUrl: string): Promise<ResultadoMarcaDagua> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, watermarked: false };
  }

  let { width, height } = bitmap;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, watermarked: false };
  ctx.drawImage(bitmap, 0, 0, width, height);

  async function exportar(watermarked: boolean): Promise<ResultadoMarcaDagua> {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
    );
    if (!blob) return { file, watermarked: false };
    return { file: new File([blob], nomeWebp(file.name), { type: OUTPUT_TYPE }), watermarked };
  }

  const logoBitmap = await carregarLogoBitmap(logoUrl);
  if (!logoBitmap) return exportar(false); // sem marca, mas já redimensionada/comprimida

  const logoWidth = Math.round(width * WATERMARK_WIDTH_RATIO);
  const logoHeight = Math.round(logoWidth * (logoBitmap.height / logoBitmap.width));
  const margin = Math.round(width * WATERMARK_MARGIN_RATIO);
  const logoX = width - logoWidth - margin;
  const logoY = height - logoHeight - margin;

  try {
    ctx.globalAlpha = WATERMARK_OPACITY;
    ctx.drawImage(logoBitmap, logoX, logoY, logoWidth, logoHeight);
    ctx.globalAlpha = 1;
  } catch {
    return { file, watermarked: false };
  }

  try {
    return await exportar(true);
  } catch {
    return { file, watermarked: false };
  }
}
