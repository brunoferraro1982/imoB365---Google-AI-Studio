// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
//
// `nitro` fica auto-off fora do sandbox da Lovable por padrão — um `npm run
// build` normal produz só o módulo cru `fetch(request, env, ctx)` em
// dist/server/server.js, sem servidor Node por trás. Pra gerar um bundle
// Node.js pronto pra rodar (deploy fora da Lovable, ex.: VPS próprio), force
// o preset node-server via `DEPLOY_TARGET=node npm run build` — não afeta o
// build padrão nem o fluxo de publish da Lovable, que continuam intocados.
const isNodeDeploy = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  // Nitro's node-server preset auto-detects the root index.html as a generic
  // SPA-fallback catch-all route, which silently wins over the real SSR handler
  // (see src/nitro-node-renderer.ts for the full explanation). Overriding
  // `renderer.handler` routes the catch-all to the actual SSR entry instead.
  // `renderer` is a real nitro/vite option forwarded as-is by defineConfig, but
  // @lovable.dev/vite-tanstack-config's own type surface doesn't declare it.
  nitro: (isNodeDeploy
    ? { preset: "node-server", renderer: { handler: "./src/nitro-node-renderer.ts" } }
    : undefined) as { preset: string; renderer: { handler: string } } | undefined,
  // jsdom (via isomorphic-dompurify em src/lib/sanitizeHtml.ts) não pode ser
  // inlinado pelo Rollup: ele e suas dependências transitivas (css-tree,
  // whatwg-url...) fazem `require()`s relativos a arquivos de dados/asset
  // reais (data/patch.json, browser/default-stylesheet.css, xhr-sync-
  // worker.js — 3 achados reais, provavelmente não os únicos) que o bundle
  // único por dependência do Nitro não consegue rastrear/copiar — causou
  // incidente real de produção duas vezes (ver changelog "Assistente de IA"
  // 2026-07-24, e o fix deste commit). Marcado external aqui (fica um
  // require("jsdom") de verdade no bundle) + scripts/copy-jsdom-external.mjs
  // (postbuild) copia a árvore de dependências real do jsdom via
  // @vercel/nft pra dist/server/node_modules — Node resolve normalmente a
  // partir daí (sobe diretórios a partir de quem chama, acha
  // dist/server/node_modules).
  vite: isNodeDeploy
    ? { ssr: { external: ["jsdom"] }, build: { rollupOptions: { external: ["jsdom"] } } }
    : undefined,
});
