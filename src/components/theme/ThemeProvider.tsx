import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" };

const ThemeCtx = createContext<Ctx>({ theme: "system", setTheme: () => {}, resolved: "light" });

function isInternalPath(path: string) {
  return path.startsWith("/app") || path.startsWith("/admin");
}

// Recebe o path explicitamente (em vez de ler window.location.pathname na hora)
// porque este provider vive acima do router e nunca remonta durante a
// navegação client-side da SPA — sem isso, o path só era checado uma vez no
// mount inicial, e o site público ficava preso em dark mode depois de
// qualquer navegação saindo de /app ou /admin com o SO em modo escuro.
function applyTheme(t: Theme, path: string): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  // Frontend público sempre em tema claro. Dark mode apenas no app interno (/app, /admin).
  if (!isInternalPath(path)) {
    document.documentElement.classList.remove("dark");
    return "light";
  }
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const r = t === "system" ? sys : t;
  document.documentElement.classList.toggle("dark", r === "dark");
  return r;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("imob365_theme") as Theme | null) ?? "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Lidos e aplicados de forma síncrona (lazy initializer, não useEffect) para que o
  // primeiro paint já saia com o tema certo — antes disso, qualquer remount completo do
  // provider (ex.: um hard reload) renderizava um frame com "system"/claro hardcoded
  // antes do efeito corrigir, causando um flash visível para dark quando o SO estava em
  // modo escuro, mesmo com o usuário tendo o tema claro salvo.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    applyTheme(readStoredTheme(), typeof window !== "undefined" ? window.location.pathname : "/"),
  );
  // Sempre atualizado, sem recriar os listeners abaixo — evita o closure
  // preso no valor de "theme" do momento em que o efeito rodou (o efeito com
  // deps [] só via a versão inicial do state pra sempre).
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Reaplica o tema a cada navegação — sem isso, sair de /app ou /admin pra
  // uma rota pública via navegação client-side (sem reload completo) deixava
  // o site público preso em dark mode, já que o path só era checado no mount
  // do provider (ver comentário em applyTheme()).
  useEffect(() => {
    setResolved(applyTheme(themeRef.current, pathname));
  }, [pathname]);

  useEffect(() => {
    // fetch user pref
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("profiles")
        .select("tema_preferido")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data: p }) => {
          const t = (p?.tema_preferido as Theme) || "system";
          setThemeState(t);
          setResolved(applyTheme(t, window.location.pathname));
        });
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themeRef.current === "system")
        setResolved(applyTheme("system", window.location.pathname));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    setResolved(applyTheme(t, window.location.pathname));
    localStorage.setItem("imob365_theme", t);
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) supabase.from("profiles").update({ tema_preferido: t }).eq("id", uid);
    });
  }

  return <ThemeCtx.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
