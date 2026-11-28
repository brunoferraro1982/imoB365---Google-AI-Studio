// imob365 · service worker (PWA)
// Regras: nunca guardar páginas autenticadas (/app, /admin, /conta) nem APIs/sessão,
// para não expor dados num computador compartilhado. Só estáticos e o shell offline público.
const CACHE = "imob365-v3";
const STATIC = [
  "/favicon.png",
  "/favicon-16.png",
  "/manifest.webmanifest",
  "/hero-bg.jpg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];
const PRIVATE_PREFIXES = [
  "/api/",
  "/auth",
  "/app",
  "/admin",
  "/conta",
  "/onboarding",
  "/login",
  "/signup",
  "/lovable/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(STATIC))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  // Área autenticada e APIs: sempre rede, sem cache.
  if (PRIVATE_PREFIXES.some((p) => path.startsWith(p))) return;

  // Arquivos estáticos com hash ou da lista: cache-first.
  if (path.startsWith("/assets/") || STATIC.includes(path)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok)
              caches
                .open(CACHE)
                .then((c) => c.put(req, res.clone()))
                .catch(() => {});
            return res;
          }),
      ),
    );
    return;
  }

  // Navegação pública: rede primeiro; sem rede, mostra o shell offline (sem guardar HTML).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Sem conexão · imob365</title><body style='font-family:system-ui;padding:32px;text-align:center'><h1>Sem conexão</h1><p>Verifique sua internet e tente novamente.</p><button onclick='location.reload()'>Tentar novamente</button>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
  }
});
