// Resize + conversão pra WebP no client via <canvas>, só pra imagens.
// Sem isso, foto de celular (comum >10MB) vai crua pro Storage e o nginx da
// VPS (client_max_body_size) corta o upload no meio → o navegador reporta
// "Failed to fetch" (não um erro HTTP legível). Comprimir antes do upload
// mantém a foto bem abaixo de qualquer limite e ainda melhora o peso das
// páginas públicas (LCP/SEO).
//
// Mesmos parâmetros de watermark.ts (MAX_DIM/qualidade/WebP) — a lógica antes
// vivia duplicada aqui e em contratos/DocumentoUpload.tsx.

const MAX_DIM = 1920;
const OUTPUT_QUALITY = 0.82;
const OUTPUT_TYPE = "image/webp";

export async function comprimirImagem(file: File): Promise<File> {
  // Só imagens; e não re-processa o que já é WebP (a marca d'água, por
  // exemplo, já sai comprimida em WebP).
  if (!file.type.startsWith("image/") || file.type === OUTPUT_TYPE) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC em alguns browsers)
    // ou arquivo corrompido — devolve o original em vez de bloquear o upload.
    return file;
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
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
  );
  if (!blob) return file;

  const nome = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], nome, { type: OUTPUT_TYPE });
}
