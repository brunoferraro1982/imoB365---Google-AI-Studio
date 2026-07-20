// Nitro's `node-server` preset auto-detects the project's root `index.html` and
// wires it as a generic SPA-fallback catch-all route (see nitro's `resolveRendererOptions`).
// That silently wins over TanStack Start's real SSR handler, which is bundled but
// never gets routed to. Pointing `nitro.renderer.handler` at this file (only for
// DEPLOY_TARGET=node builds, see vite.config.ts) makes the catch-all route call our
// actual SSR entry instead.
import serverEntry from "./server";

export default function renderIndexHTML(event: { req: Request }) {
  return serverEntry.fetch(event.req, {}, {});
}
