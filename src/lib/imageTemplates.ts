// Composição de imagem de post (foto do imóvel + preço/specs + logo) via
// <canvas> 100% client-side — mesma família de watermark.ts/imageCompress.ts
// (createImageBitmap → canvas → toBlob), estendida em duas coisas que ainda
// não existiam no projeto: recorte por proporção fixa (as duas funções
// irmãs só fazem resize proporcional, nunca corte) e texto desenhado em
// canvas (watermark.ts só compõe imagem+imagem).
//
// Deliberadamente NÃO é um editor livre — são 3 modelos prontos
// (Clássico/Moderno/Minimalista), cada um só uma variação de `config`
// (cor/layout) sobre a MESMA função de renderização.

export type TipoPost = "post" | "story";
export type TemplateLayout = "classico" | "moderno" | "minimalista";
export type TemplateConfig = { layout: TemplateLayout; overlay: string };

export const POST_SIZES: Record<TipoPost, { width: number; height: number }> = {
  // 4:5 — dentro da faixa 4:5–1.91:1 recomendada pela Meta pra feed
  post: { width: 1080, height: 1350 },
  // 9:16 — recomendado pela Meta pra Story
  story: { width: 1080, height: 1920 },
};

const DEFAULT_ACCENT = "#0f172a";

/**
 * Recorte "cover" (preenche o alvo cortando o excesso) — diferente do
 * resize "contain" (proporcional, sem cortar) usado em imageCompress.ts/
 * watermark.ts. Sempre centralizado.
 */
export function cropToAspectRatio(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;

  const targetRatio = targetWidth / targetHeight;
  const srcRatio = bitmap.width / bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (srcRatio > targetRatio) {
    sw = bitmap.height * targetRatio;
    sx = (bitmap.width - sw) / 2;
  } else {
    sh = bitmap.width / targetRatio;
    sy = (bitmap.height - sh) / 2;
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  return canvas;
}

// Mesmo padrão de carregamento já usado em watermark.ts (fetch+blob, nunca
// <img crossOrigin>) — evita canvas "tainted" por CORS de forma silenciosa.
async function carregarBitmapExterno(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const tentativa = current ? `${current} ${word}` : word;
    if (ctx.measureText(tentativa).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = tentativa;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type RenderPostImageInput = {
  fotoUrl: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  titulo: string;
  precoLabel: string;
  specsLabel: string;
  localLabel: string;
  tipoPost: TipoPost;
  config: TemplateConfig;
};

function drawOverlayEText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: RenderPostImageInput,
) {
  const accent = input.accentColor || DEFAULT_ACCENT;
  const pad = Math.round(width * 0.06);

  if (input.config.layout === "moderno") {
    const grad = ctx.createLinearGradient(0, height * 0.35, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // chip de preço, canto superior direito
    ctx.font = `700 ${Math.round(width * 0.06)}px sans-serif`;
    const precoWidth = ctx.measureText(input.precoLabel).width;
    const chipPadX = width * 0.03;
    const chipW = precoWidth + chipPadX * 2;
    const chipH = width * 0.1;
    const chipX = width - pad - chipW;
    const chipY = pad;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(input.precoLabel, chipX + chipPadX, chipY + chipH / 2);

    let y = height - pad - Math.round(width * 0.03);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = `400 ${Math.round(width * 0.04)}px sans-serif`;
    ctx.fillText(input.localLabel, pad, y);
    y -= Math.round(width * 0.06);
    ctx.font = `400 ${Math.round(width * 0.042)}px sans-serif`;
    ctx.fillText(input.specsLabel, pad, y);
    y -= Math.round(width * 0.075);
    ctx.font = `700 ${Math.round(width * 0.065)}px sans-serif`;
    const linhas = wrapText(ctx, input.titulo, width - pad * 2).slice(0, 2);
    for (let i = linhas.length - 1; i >= 0; i--) {
      ctx.fillText(linhas[i], pad, y);
      y -= Math.round(width * 0.075);
    }
    return;
  }

  if (input.config.layout === "minimalista") {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.round(width * 0.006);
    ctx.strokeRect(pad / 2, pad / 2, width - pad, height - pad);

    const plateH = Math.round(height * 0.16);
    const plateY = height - pad - plateH;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(pad, plateY, width - pad * 2, plateH);

    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "top";
    let ty = plateY + plateH * 0.16;
    ctx.font = `700 ${Math.round(width * 0.05)}px sans-serif`;
    const linhas = wrapText(ctx, input.titulo, width - pad * 2.6).slice(0, 1);
    ctx.fillText(linhas[0] ?? "", pad + pad * 0.3, ty);
    ty += Math.round(width * 0.06);
    ctx.font = `700 ${Math.round(width * 0.055)}px sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(input.precoLabel, pad + pad * 0.3, ty);
    ty += Math.round(width * 0.065);
    ctx.font = `400 ${Math.round(width * 0.035)}px sans-serif`;
    ctx.fillStyle = "#334155";
    ctx.fillText(`${input.specsLabel} · ${input.localLabel}`, pad + pad * 0.3, ty);
    return;
  }

  // "classico" (default): faixa inferior sólida na cor de destaque
  const faixaH = Math.round(height * 0.28);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, height - faixaH, width, faixaH);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  let ty = height - faixaH + faixaH * 0.12;
  ctx.font = `700 ${Math.round(width * 0.058)}px sans-serif`;
  const linhas = wrapText(ctx, input.titulo, width - pad * 2).slice(0, 2);
  for (const linha of linhas) {
    ctx.fillText(linha, pad, ty);
    ty += Math.round(width * 0.066);
  }
  ctx.font = `700 ${Math.round(width * 0.07)}px sans-serif`;
  ctx.fillText(input.precoLabel, pad, ty + Math.round(width * 0.01));
  ty += Math.round(width * 0.09);
  ctx.font = `400 ${Math.round(width * 0.038)}px sans-serif`;
  ctx.fillText(`${input.specsLabel} · ${input.localLabel}`, pad, ty);
}

/**
 * Compõe a imagem final do post: foto recortada na proporção certa +
 * overlay/texto do template escolhido + logo do tenant por cima. Nunca
 * lança — falha em carregar o logo só faz a imagem sair sem ele.
 */
export async function renderPostImage(input: RenderPostImageInput): Promise<Blob> {
  const size = POST_SIZES[input.tipoPost];
  const fotoBitmap = await carregarBitmapExterno(input.fotoUrl);
  if (!fotoBitmap) throw new Error("Não foi possível carregar a foto do imóvel");

  const canvas = cropToAspectRatio(fotoBitmap, size.width, size.height);
  const ctx = canvas.getContext("2d")!;

  drawOverlayEText(ctx, size.width, size.height, input);

  if (input.logoUrl) {
    const logoBitmap = await carregarBitmapExterno(input.logoUrl);
    if (logoBitmap) {
      const logoW = Math.round(size.width * 0.16);
      const logoH = Math.round(logoW * (logoBitmap.height / logoBitmap.width));
      const margin = Math.round(size.width * 0.04);
      ctx.drawImage(logoBitmap, margin, margin, logoW, logoH);
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Falha ao gerar a imagem do post");
  return blob;
}
