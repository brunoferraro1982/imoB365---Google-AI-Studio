// jsdom (via isomorphic-dompurify, src/lib/sanitizeHtml.ts) é marcado
// `ssr.external` no Vite (ver vite.config.ts) em vez de deixar o Rollup
// inliná-lo num único arquivo por dependência — jsdom e várias das suas
// dependências transitivas (css-tree, whatwg-url...) fazem `require()`s
// relativos a arquivos de dados/asset reais no disco (ex.:
// css-tree/data/patch.json, jsdom/lib/jsdom/browser/default-stylesheet.css,
// xhr-sync-worker.js — 3 achados reais ao investigar, provavelmente não os
// únicos) que o bundler não consegue rastrear/copiar sozinho, causando
// MODULE_NOT_FOUND em produção sempre que sanitizeHtml() era chamado
// (afetava todo tenant salvando conteúdo do site em /app/site). Mesma causa
// raiz de um incidente anterior (changelog "Assistente de IA", 2026-07-24),
// resolvido lá trocando por regex — aqui não dá, é sanitização real contra
// XSS, não extração de texto.
//
// Em vez de tentar re-sanitizar com uma lib mais leve (linkedom: DOMPurify
// detecta ambiente não suportado e faz passthrough SEM sanitizar nada;
// happy-dom: sanitiza mas descarta elementos de bloco de nível superior tipo
// <p>/<h1-3>, corrompendo formatação legítima — ambos testados e
// descartados), a correção usa @vercel/nft (node-file-trace, a mesma
// ferramenta que Vercel/Nitro usam internamente) pra rastrear TODOS os
// arquivos reais que jsdom precisa em runtime — incluindo os assets não-JS
// que o Rollup não rastreia — e copiá-los intactos, preservando a
// estrutura relativa exata, pra dist/server/node_modules/. A partir daí a
// resolução de módulo normal do Node (sobe diretórios a partir de quem
// chama até achar node_modules) resolve tudo certinho, porque o pacote
// nunca foi bundlado/achatado — está rodando exatamente como no repo.
import { nodeFileTrace } from "@vercel/nft";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distServerDir = join(repoRoot, "dist/server");

// No-op silencioso fora do build DEPLOY_TARGET=node — jsdom só é marcado
// `ssr.external` (vite.config.ts) nesse caminho; no build padrão (fluxo de
// publish da Lovable) ele continua bundlado normalmente, sem precisar disso.
if (process.env.DEPLOY_TARGET !== "node" || !existsSync(distServerDir)) {
  process.exit(0);
}

const require = createRequire(import.meta.url);
const jsdomEntry = require.resolve("jsdom");

const { fileList, esmFileList } = await nodeFileTrace([jsdomEntry], { base: repoRoot });
const allFiles = new Set([...fileList, ...esmFileList]);

let copied = 0;
for (const relPath of allFiles) {
  const src = join(repoRoot, relPath);
  const dest = join(distServerDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  copied++;
}

console.log(
  `[copy-jsdom-external] jsdom externalizado: ${copied} arquivos copiados (via @vercel/nft) pra dist/server/node_modules/`,
);
