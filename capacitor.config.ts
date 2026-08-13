import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — empacota o MESMO app web (SSR/PWA) como app nativo Android/iOS,
 * sem um segundo código. Fase C do programa mobile.
 *
 * Estratégia: shell nativo fino apontando pro PWA em produção
 * (`server.url = https://portal.imob365.com.br`). Como o app é SSR (TanStack
 * Start/Nitro), embutir um bundle estático não faz sentido — o app nativo
 * carrega o site real (o service worker `public/sw.js` já dá cache/offline
 * básico) e ganha, quando quiser, APIs nativas (push, câmera, geolocalização)
 * via plugins do Capacitor, reaproveitando 100% da UI já responsiva.
 *
 * `webDir` precisa existir pro `npx cap sync`/`cap copy` — apontamos pro build
 * do cliente (`dist/client`); com `server.url` definido, ele é só fallback.
 *
 * Passo a passo de uso está documentado no CLAUDE.md ("App nativo (Capacitor)").
 */
const config: CapacitorConfig = {
  appId: "com.imob365.portal",
  appName: "imob365",
  webDir: "dist/client",
  server: {
    url: "https://portal.imob365.com.br",
    cleartext: false,
  },
  ios: {
    // Fundo da splash/status enquanto carrega — cor da marca (theme_color).
    backgroundColor: "#0f1e3a",
  },
  android: {
    backgroundColor: "#0f1e3a",
  },
};

export default config;
