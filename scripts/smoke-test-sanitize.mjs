// Guarda contra regressão do incidente de produção corrigido em 2026-07-29:
// sanitizeHtml.ts (isomorphic-dompurify/jsdom) quebrou em runtime duas vezes
// só por causa de bundling — sem crash de build/CI/tsc, só descoberto porque
// um tenant real bateu no erro em produção, dias depois do deploy. Este
// smoke test roda como parte do postbuild (só DEPLOY_TARGET=node) e falha o
// build (exit 1) se:
//   1) jsdom (externalizado via vite.config.ts + copy-jsdom-external.mjs)
//      não conseguir nem construir um Window — pega qualquer novo arquivo
//      de asset/dado faltando (mesma causa dos 2 incidentes anteriores:
//      data/patch.json, browser/default-stylesheet.css), OU
//   2) a sanitização não se comportar como esperado — pega tanto uma lib
//      quebrada (não sanitiza nada, ex.: o que aconteceu testando linkedom)
//      quanto uma regressão no allowlist.
//
// Importa jsdom pelo caminho absoluto resolvido dentro de
// dist/server/node_modules — exatamente como o código da aplicação faz em
// runtime — em vez de confiar em cwd/relative tricks. Usa "dompurify" (a
// lib de verdade, sem nenhum arquivo de asset problemático — já verificado
// à exaustão durante a investigação deste incidente) como devDependency só
// pra este teste, não como troca da isomorphic-dompurify usada pela app.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import createDOMPurify from "dompurify";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distServerDir = join(repoRoot, "dist/server");

if (process.env.DEPLOY_TARGET !== "node" || !existsSync(distServerDir)) {
  process.exit(0);
}

const jsdomEntry = join(distServerDir, "node_modules/jsdom/lib/api.js");
if (!existsSync(jsdomEntry)) {
  console.error(
    "[smoke-test-sanitize] dist/server/node_modules/jsdom não existe — copy-jsdom-external.mjs rodou antes deste script?",
  );
  process.exit(1);
}

const { JSDOM } = await import(pathToFileURL(jsdomEntry).href);
const window = new JSDOM("<!doctype html><html><body></body></html>").window;
const DOMPurify = createDOMPurify(window);

if (!DOMPurify.isSupported) {
  console.error(
    "[smoke-test-sanitize] DOMPurify.isSupported === false com o jsdom externalizado — sanitização faria passthrough sem limpar nada.",
  );
  process.exit(1);
}

// Mesmo allowlist de src/lib/sanitizeHtml.ts — duplicado aqui de propósito
// (não importado): este teste precisa continuar funcionando mesmo que
// sanitizeHtml.ts mude de implementação no futuro, contanto que o
// comportamento de segurança abaixo continue valendo.
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "u",
  "br",
  "blockquote",
  "code",
  "pre",
  "hr",
];
const ALLOWED_ATTR = ["href", "style", "target", "rel"];
const opts = { ALLOWED_TAGS, ALLOWED_ATTR };

const casos = [
  {
    nome: "conteúdo legítimo preservado (parágrafo, negrito, link)",
    in: `<p>Texto <strong>legítimo</strong> com <a href="https://exemplo.com">link</a>.</p>`,
    esperado: (out) =>
      out.includes("<p>") && out.includes("<strong>") && out.includes('href="https://exemplo.com"'),
  },
  {
    nome: "heading + lista + blockquote preservados",
    in: `<h2>Título</h2><ul><li>item</li></ul><blockquote>cit.</blockquote>`,
    esperado: (out) => out.includes("<h2>") && out.includes("<ul>") && out.includes("<blockquote>"),
  },
  {
    nome: "style permitido preservado",
    in: `<p style="color:red">com style</p>`,
    esperado: (out) => out.includes('style="color:red"'),
  },
  {
    nome: "<script> removido",
    in: `<script>alert(1)</script><p>oi</p>`,
    esperado: (out) => !out.includes("<script"),
  },
  {
    nome: "onerror removido",
    in: `<img src=x onerror="alert(1)">`,
    esperado: (out) => !out.includes("onerror"),
  },
  {
    nome: "onclick removido",
    in: `<p onclick="alert(1)">texto</p>`,
    esperado: (out) => !out.includes("onclick"),
  },
  {
    nome: "javascript: href removido",
    in: `<a href="javascript:alert(1)">clique</a>`,
    esperado: (out) => !out.includes("javascript:"),
  },
  {
    nome: "<iframe> removido",
    in: `<iframe src="https://evil.com"></iframe><p>depois</p>`,
    esperado: (out) => !out.includes("<iframe"),
  },
];

let falhas = 0;
for (const c of casos) {
  const out = DOMPurify.sanitize(c.in, opts);
  const ok = c.esperado(out);
  if (!ok) {
    falhas++;
    console.error(`[smoke-test-sanitize] FALHOU: ${c.nome}\n  in:  ${c.in}\n  out: ${out}`);
  }
}

if (falhas > 0) {
  console.error(
    `[smoke-test-sanitize] ${falhas}/${casos.length} caso(s) falharam — build abortado.`,
  );
  process.exit(1);
}

console.log(
  `[smoke-test-sanitize] OK — jsdom externalizado + sanitização validados (${casos.length} casos).`,
);
