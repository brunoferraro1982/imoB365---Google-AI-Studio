// Nitro's node-server preset auto-detects the project's root index.html and wires it
// as a generic SPA-fallback catch-all route (see nitro's `resolveRendererOptions`),
// which silently wins over TanStack Start's real SSR handler. Pointing
// `nitro.renderer.handler` at this file (only for DEPLOY_TARGET=node builds, see
// vite.config.ts) routes the catch-all to the real SSR entry instead.
//
// IMPORTANT: this file must NOT import `@tanstack/react-start/server-entry` (directly
// or transitively, e.g. via ./server.ts) — doing so makes Vite/Rollup build a *second*,
// separate copy of TanStack Start's server runtime just for this entry point. That
// second copy resolves the start-manifest virtual module independently from the "real"
// one Nitro already builds for its own `services.ssr` environment, and — due to a
// TanStack Start + Nitro v3 node-server interaction bug — that second copy's manifest
// silently falls back to referencing a dev-only client entry that doesn't exist in
// production, so the app never hydrates in the browser (no console error either: the
// SSR HTML renders fine, it just points at the wrong script src).
//
// `fetchViteEnv("ssr", ...)` instead delegates to Nitro's own already-correctly-built
// "ssr" Vite environment service (wired up as `globalThis.__nitro_vite_envs__.ssr` in
// dist/server/index.mjs), so there's only ever one SSR build to go stale.
import { fetchViteEnv } from "nitro/vite/runtime";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default async function renderIndexHTML(event: { req: Request }): Promise<Response> {
  try {
    const response = await fetchViteEnv("ssr", event.req);
    return await normalizeCatastrophicSsrResponse(response);
  } catch (error) {
    console.error(error);
    return brandedErrorResponse();
  }
}
