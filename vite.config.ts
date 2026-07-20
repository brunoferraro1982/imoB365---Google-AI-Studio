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
});
